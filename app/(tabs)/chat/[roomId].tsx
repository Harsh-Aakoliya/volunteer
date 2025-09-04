// app/chat/[roomId].tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  AppState,
  Pressable,
  BackHandler,
  Keyboard,
  ScrollView,
  Animated,
} from "react-native";
import {
  PanGestureHandler,
  GestureHandlerRootView,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import { Message, ChatRoom, ChatUser } from "@/types/type";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { useFocusEffect } from "@react-navigation/native";
import socketService from "@/utils/socketService";
import OnlineUsersIndicator from "@/components/chat/OnlineUsersIndicator";
import MembersModal from "@/components/chat/MembersModal";
import MessageStatus from "@/components/chat/MessageStatus";
import GlobalPollModal from "@/components/chat/GlobalPollModal";
import RenderDriveFiles from "@/components/chat/RenderDriveFiles";
import RenderTable from "@/components/chat/Attechments/RenderTable";
import MediaViewerModal from "@/components/chat/MediaViewerModal";
import ChatMessageOptions from "@/components/chat/ChatMessageOptions";
import ForwardMessagesModal from "@/components/chat/ForwardMessagesModal";
import AttachmentsGrid from "./Attechments-grid";
import MessageInput from "@/components/chat/MessageInput";

interface RoomDetails extends ChatRoom {
  members: ChatUser[];
  messages: Message[];
}

interface MentionSegment {
  text: string;
  isMention: boolean;
  userId?: string;
  isCurrentUser?: boolean;
}

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams();
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    fullName: string | null;
  } | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<ChatUser[]>([]);
  const [appState, setAppState] = useState(AppState.currentState);

  // Message selection state
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);

  // Forward modal state
  const [showForwardModal, setShowForwardModal] = useState(false);

  const [showPollModal, setShowPollModal] = useState(false);
  const [activePollId, setActivePollId] = useState<number | null>(null);

  const [showTableModle,setShowTableModel] =useState(false);
  const [tableId,setTableId]=useState<number | null>(null);

  // Media viewer modal states
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);

  // Reply state
  const [isReplying, setIsReplying] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  
  // Animation refs for each message
  const messageAnimations = useRef<Map<string | number, Animated.Value>>(new Map());
  const hapticTriggered = useRef<Map<string | number, boolean>>(new Map());

  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // Use a Set to track received message IDs to prevent duplicates
  const receivedMessageIds = new Set<string | number>();





  // Parse message text to identify mentions (kept for rendering existing messages)
  const parseMessageText = (text: string): MentionSegment[] => {
    const segments: MentionSegment[] = [];
    const mentionRegex = /<Text>([^<]+)<\/Text>/g;
    let lastIndex = 0;
    let match: any;
  
    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, match.index),
          isMention: false
        });
      }
  
      // Check if mentioned user exists in room members
      const mentionedUser = roomMembers.find(member => 
        member.fullName?.toLowerCase() === match[1].toLowerCase()
      );
  
      if (mentionedUser) {
        // Add mention segment with @ symbol
        segments.push({
          text: `@${match[1]}`,
          isMention: true,
          userId: mentionedUser.userId,
          isCurrentUser: mentionedUser.userId === currentUser?.userId
        });
      } else {
        // Add as normal text if user doesn't exist
        segments.push({
          text: `@${match[1]}`,
          isMention: false
        });
      }
  
      lastIndex = match.index + match[0].length;
    }
  
    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isMention: false
      });
    }
  
    return segments;
  };

  // Render message text with mentions
  const renderMessageTextWithMentions = (text: string) => {
    const segments = parseMessageText(text);
    
    return (
      <Text>
        {segments.map((segment, index) => (
          <Text
            key={index}
            className={
              segment.isMention
                ? segment.isCurrentUser
                  ? "text-blue-600 bg-blue-100"
                  : "text-blue-600"
                : ""
            }
          >
            {segment.text}
          </Text>
        ))}
      </Text>
    );
  };



  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);

      if (appState.match(/inactive|background/) && nextAppState === "active") {
        loadRoomDetails();

        // Ensure socket is connected
        if (!socketService.socket?.connected) {
          const socket = socketService.connect();
          if (socket && currentUser && roomId) {
            socketService.identify(currentUser.userId);
            socketService.joinRoom(
              roomId as string,
              currentUser.userId,
              currentUser.fullName || "Anonymous"
            );
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appState, currentUser, roomId]);

  // Connect to socket when component mounts
  useEffect(() => {
    socketService.connect();
  }, []);

  // Handle Android back button when messages are selected
  useEffect(() => {
    const onBackPress = () => {
      if (selectedMessages.length > 0) {
        clearSelection();
        return true; // Prevent default back action
      }
      return false; // Allow default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [selectedMessages]);

  // Handle keyboard show/hide events for better scroll positioning
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        // When keyboard shows, scroll to end to ensure last messages are visible
        setTimeout(() => {
          if (flatListRef.current && messages.length > 0) {
            console.log("Keyboard opened, scrolling to end");
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // When keyboard hides, also scroll to end for consistency
        setTimeout(() => {
          if (flatListRef.current && messages.length > 0) {
            console.log("Keyboard closed, scrolling to end");
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [messages.length]);

  // Join room and set up socket event listeners
  useEffect(() => {
    if (roomId && currentUser) {
      // Keep track of received message IDs to prevent duplicates
      const receivedMessageIds = new Set();

      // Join the room
      socketService.joinRoom(
        roomId as string,
        currentUser.userId,
        currentUser.fullName || "Anonymous"
      );

      // Listen for online users updates
      socketService.onOnlineUsers(
        ({ roomId: updatedRoomId, onlineUsers: users }) => {
          if (updatedRoomId === roomId) {
            setOnlineUsers(users);
          }
        }
      );

      // Listen for room members updates
      socketService.onRoomMembers(({ roomId: updatedRoomId, members }) => {
        if (updatedRoomId === roomId) {
          setRoomMembers(members);
        }
      });

      // Listen for new messages
      socketService.onNewMessage((data) => {
        if (data.roomId === roomId) {
          console.log("New message received:", data);

          // Check if we've already received this message
          if (receivedMessageIds.has(data.id)) {
            console.log("Duplicate message detected, ignoring:", data.id);
            return;
          }

          // Add message ID to our set
          receivedMessageIds.add(data.id);

          // Only add messages from other users
          if (data.sender.userId !== currentUser.userId) {
            // Add the new message to the list
            const newMessage: Message = {
              id: data.id,
              roomId: parseInt(data.roomId),
              senderId: data.sender.userId,
              senderName: data.sender.userName,
              messageText: data.messageText,
              messageType: data.messageType,
              createdAt: data.createdAt,
              mediaFilesId: data?.mediaFilesId,
              pollId: data?.pollId,
              tableId: data?.tableId
            };
            setMessages((prev) => {
              const updatedMessages = [...prev, newMessage];
              // Scroll to bottom when new message arrives with proper timing
              setTimeout(() => { 
                // console.log("flatlistref on new message", flatListRef.current);
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 200);
              return updatedMessages;
            });
          }
        }
      });

      // Listen for message deletions
      socketService.onMessagesDeleted((data) => {
        if (data.roomId === roomId) {
          console.log("Messages deleted:", data);
          
          // Remove deleted messages from the list
          setMessages((prev) => prev.filter(msg => !data.messageIds.includes(msg.id)));
        }
      });

      // Listen for message edits
      socketService.onMessageEdited((data) => {
        if (data.roomId === roomId) {
          console.log("Message edited:", data);
          
          // Update the edited message in the list
          setMessages((prev) => prev.map(msg => 
            msg.id === data.messageId 
              ? {
                  ...msg,
                  messageText: data.messageText,
                  isEdited: data.isEdited,
                  editedAt: data.editedAt,
                  editedBy: data.editedBy,
                  editorName: data.editorName
                }
              : msg
          ));
        }
      });

      return () => {
        // Leave the room when component unmounts
        socketService.leaveRoom(roomId as string, currentUser.userId);
      };
    }
  }, [roomId, currentUser]);

  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        loadRoomDetails();
      }
      return () => {
        // Clear message selection when navigating away
        setSelectedMessages([]);
        // Clear reply state when navigating away
        setIsReplying(false);
        setReplyToMessage(null);
        // Clear active poll state when navigating away
        setActivePollId(null);
        setShowPollModal(false);
      };
    }, [roomId])
  );

  useEffect(() => {
    if (room) {
      // Set header options
      navigation.setOptions({
        title: room.roomName,
        headerRight: () =>
          isGroupAdmin ? ( // Only show room settings icon if user is group admin
            <TouchableOpacity
              onPressIn={() => {
                console.log("Navigating to room settings with roomId:", roomId);
                router.push({
                  pathname: "/chat/room-settings",
                  params: { roomId },
                });
              }}
              className="mr-2"
            >
              <Ionicons name="settings-outline" size={24} color="#0284c7" />
            </TouchableOpacity>
          ):<></>
      });
    }
  }, [room, isGroupAdmin, navigation]); // Changed isAdmin to isGroupAdmin

  const loadRoomDetails = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUser({
          userId: userData.userId,
          fullName: userData.fullName || null
        });
      }

      // Fetch room details
      const token = await AuthStorage.getToken();
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRoom(response.data);
      setMessages(response.data.messages || []);

      // Check if current user is admin of this room (group admin)
      const isUserGroupAdmin = response.data.members.some(
        (member: ChatUser) =>
          member.userId === userData?.userId && member.isAdmin
      );
      setIsGroupAdmin(isUserGroupAdmin); // This is specifically for group admin status

      // Initialize room members with online status
      const initialMembers = response.data.members.map((member: ChatUser) => ({
        ...member,
        isOnline: false, // Will be updated by socket events
      }));
      setRoomMembers(initialMembers);

      // Join the room via socket after loading details
      if (userData) {
        socketService.joinRoom(
          roomId as string,
          userData.userId,
          userData.fullName || "Anonymous"
        );
      }

      // Scroll to end after messages are loaded (with proper delay for FlatList to mount)
      setTimeout(() => {
        if (response.data.messages && response.data.messages.length > 0) {
          console.log("scrolling to end on load room details");
          // console.log("FlatList ref:", flatListRef.current);
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }
      }, 500);
    } catch (error) {
      console.error("Error loading room details:", error);
      alert("Failed to load chat room details");
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (
    text: string, 
    messageType: string, 
    mediaFilesId?: number,
    pollId?: number,
    tableId?: number,
    replyMessageId?: number
  ) => {
    // Only allow group admins to send messages
    if (!isGroupAdmin) {
      alert("Only group admins can send messages in this room.");
      return;
    }

    if ((!text.trim() && (!mediaFilesId || !pollId || !tableId)) || !roomId || !currentUser || sending) return;

    // Trimmed message text
    const trimmedMessage = text.trim();

    try {
      setSending(true);
      setMessageText(""); // Clear input immediately for better UX

      // Create optimistic message to show immediately
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`, // Temporary ID
        roomId: parseInt(roomId as string),
        senderId: currentUser.userId,
        senderName: currentUser.fullName || "You",
        messageText: trimmedMessage,
        messageType: messageType,
        createdAt: new Date().toISOString(),
        mediaFilesId: mediaFilesId,
        pollId: pollId,
        tableId: tableId,
        replyMessageId: replyMessageId
      };

      // Add optimistic message to the list
      setMessages((prev) => {
        const updatedMessages = [...prev, optimisticMessage];
        // Scroll to the bottom immediately for user's own messages
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
        return updatedMessages;
      });

      // Send the message via API
      const token = await AuthStorage.getToken();
      const response = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        { 
          messageText: trimmedMessage,
          mediaFilesId: mediaFilesId,
          pollId: pollId,
          messageType: messageType,
          tableId: tableId,
          replyMessageId: replyMessageId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Handle the response which might be a single message or an array of messages
      const newMessages = Array.isArray(response.data) 
        ? response.data
        : [response.data];

      // Add sender name to all messages
      const messagesWithSenderName = newMessages.map(msg => ({
        ...msg,
        senderName: currentUser.fullName || "You",
      }));

      // Replace optimistic messages with real ones from the server
      setMessages((prev) => {
        // Filter out all temp messages
        const filteredMessages = prev.filter(
          msg => !(typeof msg.id === 'string' && msg.id.includes('temp'))
        );
        // Add the new messages from the server
        const updatedMessages = [...filteredMessages, ...messagesWithSenderName];
        // Ensure scroll position is maintained after server response
        setTimeout(() => {
          // console.log("flatlistref on send message", flatListRef.current);
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }, 150);
        return updatedMessages;
      });

      // Send the messages via socket for real-time delivery
      messagesWithSenderName.forEach(newMessage => {
        socketService.sendMessage(roomId as string, newMessage, {
          userId: currentUser.userId,
          userName: currentUser.fullName || "Anonymous",
        });
      });

      // Clear reply state after sending
      if (isReplying) {
        handleCancelReply();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");

      // Restore the message text if sending failed
      setMessageText(trimmedMessage);

      // Remove the optimistic message
      setMessages((prev) => prev.filter((msg) => typeof msg.id === "number" || (typeof msg.id === 'string' && !msg.id.includes('temp'))));
    } finally {
      setSending(false);
    }
  };

  // Helper function to handle opening media viewer
  const openMediaViewer = (mediaId: number) => {
    console.log("Opening media viewer for media ID:", mediaId);
    setSelectedMediaId(mediaId);
    setShowMediaViewer(true);
  };

  // Message selection helper functions
  const isMessageSelected = (messageId: string | number) => {
    return selectedMessages.some(msg => msg.id === messageId);
  };

  const handleMessageLongPress = (message: Message) => {
    // Only allow group admins to select messages
    if (!isGroupAdmin) {
      return; // Don't allow message selection for non-group admins
    }

    if (selectedMessages.length === 0) {
      // First message selection
      setSelectedMessages([message]);
    } else {
      // Add to existing selection
      if (!isMessageSelected(message.id)) {
        setSelectedMessages(prev => [...prev, message]);
      }
    }
  };

  const handleMessagePress = (message: Message) => {
    // Only allow group admins to interact with message selection
    if (!isGroupAdmin) {
      return; // Don't allow message interaction for non-group admins
    }

    if (selectedMessages.length > 0) {
      // If in selection mode, toggle selection
      if (isMessageSelected(message.id)) {
        setSelectedMessages(prev => prev.filter(msg => msg.id !== message.id));
      } else {
        setSelectedMessages(prev => [...prev, message]);
      }
    }
  };

  const clearSelection = () => {
    setSelectedMessages([]);
  };

  // Reply handling functions
  const handleStartReply = (message: Message) => {
    setReplyToMessage(message);
    setIsReplying(true);
    // Clear any message selection when starting reply
    setSelectedMessages([]);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
    setIsReplying(false);
  };

  // Get or create animation value for a message
  const getMessageAnimation = (messageId: string | number) => {
    if (!messageAnimations.current.has(messageId)) {
      messageAnimations.current.set(messageId, new Animated.Value(0));
    }
    return messageAnimations.current.get(messageId)!;
  };

  // Swipe gesture handlers
  const handleGestureBegin = (messageId: string | number) => {
    const animation = getMessageAnimation(messageId);
    animation.setValue(0);
    hapticTriggered.current.set(messageId, false);
  };

  const handleGestureUpdate = (event: any, messageId: string | number) => {
    const { translationX } = event.nativeEvent;
    const animation = getMessageAnimation(messageId);
    
    // Limit the translation to reasonable bounds
    const maxTranslation = 80;
    const limitedTranslation = Math.max(-maxTranslation, Math.min(maxTranslation, translationX));
    
    animation.setValue(limitedTranslation);
    
    // Trigger haptic feedback when threshold is reached
    const threshold = 50;
    if (Math.abs(limitedTranslation) > threshold && !hapticTriggered.current.get(messageId)) {
      hapticTriggered.current.set(messageId, true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleGestureEnd = (event: any, message: Message) => {
    const { translationX, velocityX } = event.nativeEvent;
    const animation = getMessageAnimation(message.id);
    const threshold = 50; // Minimum swipe distance to trigger reply
    
    if (Math.abs(translationX) > threshold || Math.abs(velocityX) > 500) {
      // Trigger reply
      handleStartReply(message);
      
      // Animate back to original position
      Animated.spring(animation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    } else {
      // Animate back to original position
      Animated.spring(animation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    }
  };

  // Handle message edit
  const handleMessageEdited = (editedMessage: Message) => {
    setMessages((prev) => prev.map(msg => 
      msg.id === editedMessage.id ? editedMessage : msg
    ));
  };

  // Forward messages with delay and progress tracking
  const handleForwardMessages = async (selectedRooms: ChatRoom[], messagesToForward: Message[]) => {
    const totalOperations = selectedRooms.length * messagesToForward.length;
    let completedOperations = 0;

    console.log(`Starting to forward ${messagesToForward.length} messages to ${selectedRooms.length} rooms`);

    // Process each room and message combination with delay
    for (const room of selectedRooms) {
      if (!room.roomId) continue;

      for (const message of messagesToForward) {
        try {
          completedOperations++;
          console.log(`Forwarding message ${completedOperations}/${totalOperations} to room ${room.roomName}`);

          // Send message to specific room using API directly
          const token = await AuthStorage.getToken();
          const response = await axios.post(
            `${API_URL}/api/chat/rooms/${room.roomId}/messages`,
            { 
              messageText: message.messageText || "",
              mediaFilesId: message.mediaFilesId,
              pollId: message.pollId,
              messageType: message.messageType,
              tableId: message.tableId
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Get the created message from response
          const createdMessage = response.data;

          // Manually trigger socket sendMessage event to ensure unread counts and room updates work
          // This mimics what happens in regular messaging
          if (currentUser && createdMessage) {
            socketService.sendMessage(room.roomId.toString(), {
              id: createdMessage.id,
              roomId: room.roomId,
              senderId: currentUser.userId,
              senderName: currentUser.fullName || "You",
              messageText: message.messageText || "",
              messageType: message.messageType,
              createdAt: createdMessage.createdAt,
              mediaFilesId: message.mediaFilesId,
              pollId: message.pollId,
              tableId: message.tableId
            }, {
              userId: currentUser.userId,
              userName: currentUser.fullName || "Anonymous",
            });
          }

          // Add delay between messages to prevent socket issues (1 second as requested)
          if (completedOperations < totalOperations) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error(`Error forwarding message to room ${room.roomName}:`, error);
          throw error; // Re-throw to let the modal handle the error
        }
      }
    }

    console.log('All messages forwarded successfully');
    
    // Clear selection and close forward modal
    clearSelection();
    setShowForwardModal(false);
  };

  // Delete messages functionality
  const handleDeleteMessages = async (messageIds: (string | number)[]) => {
    try {
      console.log(`Deleting ${messageIds.length} messages`);
      
      const token = await AuthStorage.getToken();
      await axios.delete(`${API_URL}/api/chat/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { messageIds }
      });

      console.log('Messages deleted successfully');
    } catch (error) {
      console.error('Error deleting messages:', error);
      throw error; // Re-throw to let the component handle the error
    }
  };

  // Render message function to support media files
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUser?.userId;
    const isSelected = isMessageSelected(item.id);

    // Determine message status
    let messageStatus: "sending" | "sent" | "delivered" | "read" | "error" =
      "sent";

    if (typeof item.id === "number") {
      messageStatus = "delivered"; // For messages with real IDs from the server
    } else if (typeof item.id === "string") {
      if (item.id.toString().includes("temp")) {
        messageStatus = "sending"; // For optimistic messages
      }
    }

    const messageAnimation = getMessageAnimation(item.id);

    return (
      <View className="relative">
        {/* Reply icon background - shows during swipe */}
        <Animated.View
          className="absolute top-0 bottom-0 right-4 flex items-center justify-center"
          style={{
            opacity: messageAnimation.interpolate({
              inputRange: [-80, -30, 0],
              outputRange: [1, 0.5, 0],
              extrapolate: 'clamp',
            }),
          }}
        >
          <View className="bg-blue-500 rounded-full p-2">
            <Ionicons name="arrow-undo" size={20} color="white" />
          </View>
        </Animated.View>

        <Animated.View
          className="absolute top-0 bottom-0 left-4 flex items-center justify-center"
          style={{
            opacity: messageAnimation.interpolate({
              inputRange: [0, 30, 80],
              outputRange: [0, 0.5, 1],
              extrapolate: 'clamp',
            }),
          }}
        >
          <View className="bg-blue-500 rounded-full p-2">
            <Ionicons name="arrow-undo" size={20} color="white" />
          </View>
        </Animated.View>

        <PanGestureHandler
          onBegan={() => handleGestureBegin(item.id)}
          onGestureEvent={(event) => handleGestureUpdate(event, item.id)}
          onEnded={(event) => handleGestureEnd(event, item)}
          onCancelled={(event) => handleGestureEnd(event, item)}
          onFailed={(event) => handleGestureEnd(event, item)}
          enabled={!isMessageSelected(item.id)} // Disable swipe when message is selected
          activeOffsetX={[-10, 10]} // Allow small movements before taking over
          failOffsetY={[-50, 50]} // Fail gesture if moving too much vertically (preserves scroll)
          shouldCancelWhenOutside={true}
        >
          <Animated.View
            style={{
              transform: [{ translateX: messageAnimation }],
            }}
          >
            <Pressable
              onPress={() => handleMessagePress(item)}
              onLongPress={() => handleMessageLongPress(item)}
              delayLongPress={300}
              className="relative"
            >
          {/* Selection overlay - covers full width */}
          {isSelected && (
            <View 
              className="absolute top-0 bottom-0 left-0 right-0 bg-black"
              style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.15)',
                marginLeft: -16,
                marginRight: -16,
                zIndex: 1
              }}
            />
          )}
          
          <View
            className={`p-2 max-w-[80%] rounded-lg my-1 relative ${
              isOwnMessage ? "bg-blue-500 self-end" : "bg-gray-200 self-start"
            }`}
            style={{ zIndex: 2 }}
          >
          {/* Reply preview - show if this message is replying to another */}
          {item.replyMessageId && (
            <View className={`mb-2 p-2 rounded border-l-2 ${
              isOwnMessage 
                ? 'bg-blue-400 border-blue-200' 
                : 'bg-gray-300 border-gray-400'
            }`}>
              <Text className={`text-xs ${
                isOwnMessage ? 'text-blue-100' : 'text-gray-600'
              }`}>
                {item.replySenderName}
              </Text>
              <Text 
                className={`text-sm ${
                  isOwnMessage ? 'text-white' : 'text-gray-800'
                }`}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.replyMessageText || 'Message'}
              </Text>
            </View>
          )}
          {!isOwnMessage && (
            <Text className="text-xs font-bold text-gray-600">
              {item.senderName || "Unknown"}
            </Text>
          )}
          
          {item.messageText && (
            <View>
              <View className={isOwnMessage ? "text-white" : "text-black"}>
                {renderMessageTextWithMentions(item.messageText)}
              </View>
              {/* Show edit indicator */}
              {item.isEdited && (
                <Text className={`text-xs italic mt-1 ${
                  isOwnMessage ? "text-blue-200" : "text-gray-500"
                }`}>
                  edited
                  {item.editedBy !== item.senderId && item.editorName && 
                    ` by ${item.editorName}`
                  }
                  {item.editedAt && 
                    ` • ${new Date(item.editedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  }
                </Text>
              )}
            </View>
          )}
          
          {/* Render media files if present */}
          {item.mediaFilesId ? (
            <TouchableOpacity 
              onPress={() => item.mediaFilesId && openMediaViewer(item.mediaFilesId)}
              className="bg-blue-100 p-2 rounded-lg mt-1"
            >
              <Text className="text-blue-700 font-semibold">📁 Media Files</Text>
              <Text className="text-blue-600 text-xs">Tap to view media</Text>
            </TouchableOpacity>
          ) : null}

          {/* Render table if present */}
          {item.tableId ? (
            <TouchableOpacity 
              onPress={() => {
                if (typeof item.tableId === 'number') {
                  setTableId(item.tableId);
                  setShowTableModel(true);
                }
              }}>
              <Text>Show table</Text>
            </TouchableOpacity>
          ) : null}

          {showTableModle && tableId !== null && currentUser?.userId && (
            <RenderTable 
              tableId={tableId}
              visible={showTableModle}
              setShowTable={setShowTableModel}
            />
          )}

          {/* Render poll if present */}
          {item.pollId ? (
            <TouchableOpacity
              onPress={() => {
                if (typeof item.pollId === 'number') {
                  // Only allow one poll to be active at a time
                  if (!showPollModal) {
                    setActivePollId(item.pollId);
                    setShowPollModal(true);
                  }
                }
              }}
              disabled={showPollModal && activePollId !== item.pollId}
              className={`p-3 rounded-lg ${
                showPollModal && activePollId !== item.pollId
                  ? 'bg-gray-200 opacity-50'
                  : 'bg-blue-100'
              }`}
            >
              <Text className={`font-semibold ${
                showPollModal && activePollId !== item.pollId
                  ? 'text-gray-500'
                  : 'text-blue-700'
              }`}>
                📊 Poll
              </Text>
              <Text className={`text-xs ${
                showPollModal && activePollId !== item.pollId
                  ? 'text-gray-400'
                  : 'text-blue-600'
              }`}>
                {showPollModal && activePollId !== item.pollId
                  ? 'Another poll is active'
                  : 'Tap to vote'
                }
              </Text>
            </TouchableOpacity>
          ) : null}

          <View className="flex-row justify-between items-center mt-1">
            <Text
              className={`text-xs ${
                isOwnMessage ? "text-blue-100" : "text-gray-500"
              }`}
            >
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {isOwnMessage && (
              <MessageStatus status={messageStatus} className="ml-1" />
            )}
          </View>
        </View>
            </Pressable>
          </Animated.View>
        </PanGestureHandler>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (!room) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Ionicons name="alert-circle-outline" size={60} color="#d1d5db" />
        <Text className="text-gray-500 mt-4 text-center">
          Chat room not found or you don't have access.
        </Text>
        <TouchableOpacity
          className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
        {/* Conditional header: Show ChatMessageOptions when messages are selected AND user is group admin */}
        {selectedMessages.length > 0 && isGroupAdmin ? (
          <ChatMessageOptions
            selectedMessages={selectedMessages}
            setSelectedMessages={setSelectedMessages}
            isAdmin={isGroupAdmin} // Pass group admin status
            onClose={clearSelection}
            onForwardPress={() => setShowForwardModal(true)}
            onDeletePress={handleDeleteMessages}
            roomId={Array.isArray(roomId) ? roomId[0] : roomId}
            roomMembers={roomMembers}
            currentUser={currentUser}
            onMessageEdited={handleMessageEdited}
          />
        ) : (
          <OnlineUsersIndicator
            onlineCount={onlineUsers.length}
            totalCount={roomMembers.length}
            onPress={() => setShowMembersModal(true)}
          />
        )}

        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 16 }}
          onLayout={() => {
            // Ensure scroll to end after FlatList is laid out
            setTimeout(() => {
              if (flatListRef.current && messages.length > 0) {
                // console.log("FlatList onLayout - scrolling to end");
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }, 100);
          }}
          onContentSizeChange={() => {
            // Scroll to end when content size changes (new messages)
            setTimeout(() => {
              if (flatListRef.current && messages.length > 0) {
                // console.log("FlatList content size changed - scrolling to end");
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 100);
          }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-4 mt-10">
              <Ionicons name="chatbubble-outline" size={60} color="#d1d5db" />
              <Text className="text-gray-500 mt-4 text-center">
                No messages yet. {isGroupAdmin ? "Be the first to send a message!" : "Only group admins can send messages in this room."}
              </Text>
            </View>
          }
        />

        {/* Reply preview - show above message input when replying */}
        {isReplying && replyToMessage && (
          <View className="bg-gray-100 border-t border-gray-200 px-4 py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="arrow-undo" size={16} color="#6b7280" />
                  <Text className="text-sm text-gray-600 ml-2">
                    Replying to {replyToMessage.senderName}
                  </Text>
                </View>
                <Text 
                  className="text-sm text-gray-800 bg-white px-3 py-2 rounded-lg"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {replyToMessage.messageText}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelReply}
                className="ml-3 p-2"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Message input - Only show for group admins */}
        {isGroupAdmin && (
          <MessageInput
            messageText={messageText}
            onChangeText={setMessageText}
            onSend={(text: string, messageType: string, mediaFilesId?: number, pollId?: number, tableId?: number) => 
              sendMessage(text, messageType, mediaFilesId, pollId, tableId, replyToMessage?.id as number)
            }
            sending={sending}
            disabled={false}
            roomMembers={roomMembers}
            currentUser={currentUser}
            roomId={roomId as string}
            showAttachments={true}
            onFocus={() => {
              // When input is focused, scroll to end to ensure last messages are visible
              setTimeout(() => {
                if (flatListRef.current && messages.length > 0) {
                  console.log("MessageInput focused - scrolling to end");
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 300);
            }}
            style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: 'white' }}
          />
        )}

        {/* Non-admin message - Show for non-group admins */}
        {!isGroupAdmin && (
          <View className="p-4 border-t border-gray-200 bg-gray-50">
            <Text className="text-center text-gray-600 text-sm">
              Only group admins can send messages in this room
            </Text>
          </View>
        )}

        {/* Members Modal to show who are currently online in this room */}
        <MembersModal
          visible={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          members={roomMembers.map((member) => ({
            userId: member.userId,
            fullName: member.fullName || "Unknown User",
            isAdmin: Boolean(member.isAdmin),
            isOnline: Boolean(member.isOnline),
          }))}
          currentUserId={currentUser?.userId || ""}
        />

        {/* Media Viewer Modal */}
        {selectedMediaId && (
          <MediaViewerModal
            visible={showMediaViewer}
            onClose={() => {
              setShowMediaViewer(false);
              setSelectedMediaId(null);
            }}
            mediaId={selectedMediaId}
          />
        )}

        {/* Forward Messages Modal - Only show for group admins */}
        {isGroupAdmin && (
          <ForwardMessagesModal
            visible={showForwardModal}
            onClose={() => setShowForwardModal(false)}
            selectedMessages={selectedMessages}
            currentRoomId={roomId as string}
            onForward={handleForwardMessages}
          />
        )}

        {/* Global Poll Modal - Single instance for all polls */}
        <GlobalPollModal
          pollId={activePollId}
          visible={showPollModal}
          onClose={() => {
            setShowPollModal(false);
            setActivePollId(null);
          }}
          currentUserId={currentUser?.userId || ""}
          totalMembers={roomMembers.length}
        />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}