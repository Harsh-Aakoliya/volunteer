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
  Modal,
} from "react-native";
import {
  PanGestureHandler,
  GestureHandlerRootView
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import { Message, ChatRoom, ChatUser } from "@/types/type";
import { getISTTimestamp, formatISTTime, formatISTDate, isSameDayIST, getRelativeTimeIST } from "@/utils/dateUtils";
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
import { clearRoomNotifications } from "@/utils/chatNotificationHandler";

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
  const [messagesSet, setMessagesSet] = useState<Set<string | number>>(new Set());
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

  // Read status state
  const [showReadStatus, setShowReadStatus] = useState(false);
  const [selectedMessageForReadStatus, setSelectedMessageForReadStatus] = useState<Message | null>(null);
  const [readStatusData, setReadStatusData] = useState<{
    readBy: Array<{userId: string, fullName: string, readAt: string}>;
    unreadBy: Array<{userId: string, fullName: string}>;
  } | null>(null);
  const [isLoadingReadStatus, setIsLoadingReadStatus] = useState(false);

  // Scroll to bottom state
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  
  // Animation refs for each message
  const messageAnimations = useRef<Map<string | number, Animated.Value>>(new Map());
  const hapticTriggered = useRef<Map<string | number, boolean>>(new Map());
  const blinkAnimations = useRef<Map<string | number, Animated.Value>>(new Map());

  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // Helper function to add message to both array and set
  const addMessage = (message: Message) => {
    if (!messagesSet.has(message.id)) {
      setMessagesSet(prev => new Set(prev).add(message.id));
      setMessages(prev => [...prev, message]);
    }
  };

  // Helper function to remove message from both array and set
  const removeMessage = (messageId: string | number) => {
    setMessagesSet(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  // Helper function to update message in array
  const updateMessage = (messageId: string | number, updatedMessage: Message) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? updatedMessage : msg));
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
      setShowScrollToBottom(false);
      setIsNearBottom(true);
    }
  };

  // Handle scroll events
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    
    setIsNearBottom(isAtBottom);
    setShowScrollToBottom(!isAtBottom && messages.length > 10);
  };

  // Scroll to specific message with blink effect
  const scrollToMessage = (messageId: string | number) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ 
        index: messageIndex, 
        animated: true,
        viewPosition: 0.5
      });
      
      // Add blink effect
      const blinkAnimation = new Animated.Value(0);
      blinkAnimations.current.set(messageId, blinkAnimation);
      
      Animated.sequence([
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(() => {
        blinkAnimations.current.delete(messageId);
      });
    }
  };


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
                  ? "text-blue-600 bg-blue-100 px-1 rounded"
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

          // Only add messages from other users
          if (data.sender.userId !== currentUser.userId) {
            // Create the new message
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
            
            // Add message using helper function (prevents duplicates)
            addMessage(newMessage);
            
            // Scroll to bottom when new message arrives with proper timing
            setTimeout(() => { 
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 200);
          }
        }
      });

      // Listen for message deletions
      socketService.onMessagesDeleted((data) => {
        if (data.roomId === roomId) {
          console.log("Messages deleted:", data);
          
          // Remove deleted messages using helper function
          data.messageIds.forEach((messageId: string | number) => {
            removeMessage(messageId);
          });
        }
      });

      // Listen for message edits
      socketService.onMessageEdited((data) => {
        if (data.roomId === roomId) {
          console.log("Message edited:", data);
          
          // Update the edited message using helper function
          // First get the existing message to preserve other properties
          const existingMessage = messages.find(msg => msg.id === data.messageId);
          if (existingMessage) {
            const updatedMessage = {
              ...existingMessage,
              messageText: data.messageText,
              isEdited: data.isEdited,
              editedAt: data.editedAt,
              editedBy: data.editedBy,
              editorName: data.editorName
            };
            updateMessage(data.messageId, updatedMessage);
          }
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
      // Set header options and hide tabs
      navigation.setOptions({
        title: room.roomName,
        tabBarStyle: { display: 'none' }, // Hide tabs
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
    } else if (isLoading) {
      // Show connecting state while loading and hide tabs
      navigation.setOptions({
        title: "Connecting...",
        tabBarStyle: { display: 'none' }, // Hide tabs
        headerRight: () => <></>
      });
    }
  }, [room, isGroupAdmin, navigation, isLoading]); // Added isLoading dependency

  // Cleanup effect to restore tabs when leaving the room
  useEffect(() => {
    return () => {
      // Restore tabs when component unmounts
      navigation.setOptions({
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 60,
          paddingBottom: 5,
        }
      });
    };
  }, [navigation]);

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
      const initialMessages = response.data.messages || [];
      setMessages(initialMessages);
      setMessagesSet(new Set(initialMessages.map((msg: Message) => msg.id)));

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
        
        // Clear notifications for this room when user enters
        clearRoomNotifications(roomId as string);
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
      setIsReplying(false);
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

      // Add optimistic message using helper function
      addMessage(optimisticMessage);
      
      // Scroll to the bottom immediately for user's own messages
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);

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
      // Remove temp messages and add real ones
      setMessages((prev) => {
        const filteredMessages = prev.filter(
          msg => !(typeof msg.id === 'string' && msg.id.includes('temp'))
        );
        return [...filteredMessages, ...messagesWithSenderName];
      });
      
      // Update messages set
      setMessagesSet((prev) => {
        const newSet = new Set(prev);
        // Remove temp message IDs
        Array.from(newSet).forEach(id => {
          if (typeof id === 'string' && id.includes('temp')) {
            newSet.delete(id);
          }
        });
        // Add real message IDs
        messagesWithSenderName.forEach(msg => newSet.add(msg.id));
        return newSet;
      });
      
      // Ensure scroll position is maintained after server response
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 150);

      // Send the messages via socket for real-time delivery
      messagesWithSenderName.forEach(newMessage => {
        socketService.sendMessage(roomId as string, newMessage, {
          userId: currentUser.userId,
          userName: currentUser.fullName || "Anonymous",
        });
      });

      // Clear reply state after sending
      if (isReplying) {
        setIsReplying(false);
        setReplyToMessage(null);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");

      // Restore the message text if sending failed
      setMessageText(trimmedMessage);

      // Remove the optimistic message
      setMessages((prev) => prev.filter((msg) => typeof msg.id === "number" || (typeof msg.id === 'string' && !msg.id.includes('temp'))));
      setMessagesSet((prev) => {
        const newSet = new Set(prev);
        Array.from(newSet).forEach(id => {
          if (typeof id === 'string' && id.includes('temp')) {
            newSet.delete(id);
          }
        });
        return newSet;
      });
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
    updateMessage(editedMessage.id, editedMessage);
  };

  // Mark message as read
  const markMessageAsRead = async (messageId: string | number) => {
    try {
      const token = await AuthStorage.getToken();
      await axios.post(
        `${API_URL}/api/chat/messages/${messageId}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Fetch read status for a message
  const fetchReadStatus = async (messageId: string | number) => {
    try {
      setIsLoadingReadStatus(true);
      const token = await AuthStorage.getToken();
      const response = await axios.get(
        `${API_URL}/api/chat/messages/${messageId}/read-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setReadStatusData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching read status:', error);
      alert('Failed to load read status');
    } finally {
      setIsLoadingReadStatus(false);
    }
  };

  // Handle info icon press
  const handleInfoPress = (message: Message) => {
    setSelectedMessageForReadStatus(message);
    setShowReadStatus(true);
    fetchReadStatus(message.id);
  };

  // Refresh read status
  const refreshReadStatus = () => {
    if (selectedMessageForReadStatus) {
      fetchReadStatus(selectedMessageForReadStatus.id);
    }
  };

  // Handle viewable items change to mark messages as read
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (currentUser) {
      viewableItems.forEach((item: any) => {
        const message = item.item;
        // Only mark messages as read if they're not from the current user
        if (message && message.senderId !== currentUser.userId && typeof message.id === 'number') {
          markMessageAsRead(message.id);
        }
      });
    }
  }, [currentUser]);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50, // Mark as read when 50% of message is visible
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

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    const grouped: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const date = formatISTDate(message.createdAt, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: undefined,
        minute: undefined,
        hour12: undefined 
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(message);
    });
    
    return grouped;
  };

  // Format date for display
  const formatDateForDisplay = (dateString: string) => {
    console.log("dateString",dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if the date string is already formatted or if it's a raw date
    const todayIST = formatISTDate(today, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: undefined,
      minute: undefined,
      hour12: undefined 
    });
    const yesterdayIST = formatISTDate(yesterday, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: undefined,
      minute: undefined,
      hour12: undefined 
    });
    
    if (dateString === todayIST) {
      return "Today";
    } else if (dateString === yesterdayIST) {
      return "Yesterday";
    } else {
      return dateString; // Already formatted in IST
    }
  };

  // Render date separator
  const renderDateSeparator = (dateString: string) => (
    <View className="flex-row items-center my-4 px-4">
      <View className="flex-1 h-px bg-gray-300" />
      <Text className="mx-3 text-gray-500 text-sm font-medium">
        {formatDateForDisplay(dateString)}
      </Text>
      <View className="flex-1 h-px bg-gray-300" />
    </View>
  );

  // Render message function to support media files
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUser?.userId;
    const isSelected = isMessageSelected(item.id);
    const canPerformActions = isOwnMessage && isGroupAdmin; // Only message sender who is group admin can perform actions

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
          
          <Animated.View
            className={`px-3 py-2 mx-4 my-1 rounded-2xl relative ${
              isOwnMessage ? "bg-blue-100 ml-16" : "bg-gray-100 mr-16"
            }`}
            style={{ 
              zIndex: 2,
              maxWidth: '85%',
              alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
              backgroundColor: blinkAnimations.current.get(item.id) ? 
                blinkAnimations.current.get(item.id)!.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isOwnMessage ? '#dbeafe' : '#f3f4f6', '#fbbf24']
                }) : 
                (isOwnMessage ? '#dbeafe' : '#f3f4f6')
            }}
          >
          {/* Reply preview - show if this message is replying to another */}
          {item.replyMessageId && (
            <TouchableOpacity 
              className={`mb-2 p-2 rounded-lg border-l-2 ${
                isOwnMessage 
                  ? 'bg-blue-50 border-blue-300' 
                  : 'bg-gray-50 border-gray-400'
              }`}
              onPress={() => scrollToMessage(item.replyMessageId!)}
            >
              <Text className={`text-xs ${
                isOwnMessage ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {item.replySenderName}
              </Text>
              <Text 
                className={`text-sm ${
                  isOwnMessage ? 'text-blue-800' : 'text-gray-800'
                }`}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.replyMessageText || 'Message'}
              </Text>
            </TouchableOpacity>
          )}
          {!isOwnMessage && (
            <Text className="text-xs font-semibold text-blue-600 mb-1">
              {item.senderName || "Unknown"}
            </Text>
          )}
          
          {item.messageText && (
            <View>
              <Text className={`text-base leading-5 ${
                isOwnMessage ? "text-gray-900" : "text-gray-800"
              }`}>
                {renderMessageTextWithMentions(item.messageText)}
              </Text>
            </View>
          )}
          
          {/* Render media files if present */}
          {item.mediaFilesId ? (
            <TouchableOpacity 
              onPress={() => item.mediaFilesId && openMediaViewer(item.mediaFilesId)}
              className={`p-2 rounded-lg mt-1 ${
                isOwnMessage ? 'bg-blue-200' : 'bg-gray-200'
              }`}
            >
              <Text className={`font-semibold ${
                isOwnMessage ? 'text-blue-800' : 'text-gray-700'
              }`}>📁 Media Files</Text>
              <Text className={`text-xs ${
                isOwnMessage ? 'text-blue-600' : 'text-gray-600'
              }`}>Tap to view media</Text>
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
              }}
              className={`p-2 rounded-lg mt-1 ${
                isOwnMessage ? 'bg-blue-200' : 'bg-gray-200'
              }`}
            >
              <Text className={`font-semibold ${
                isOwnMessage ? 'text-blue-800' : 'text-gray-700'
              }`}>📊 Table</Text>
              <Text className={`text-xs ${
                isOwnMessage ? 'text-blue-600' : 'text-gray-600'
              }`}>Tap to view table</Text>
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
              className={`p-3 rounded-lg mt-1 ${
                showPollModal && activePollId !== item.pollId
                  ? 'bg-gray-200 opacity-50'
                  : isOwnMessage ? 'bg-blue-200' : 'bg-gray-200'
              }`}
            >
              <Text className={`font-semibold ${
                showPollModal && activePollId !== item.pollId
                  ? 'text-gray-500'
                  : isOwnMessage ? 'text-blue-800' : 'text-gray-700'
              }`}>
                📊 Poll
              </Text>
              <Text className={`text-xs ${
                showPollModal && activePollId !== item.pollId
                  ? 'text-gray-400'
                  : isOwnMessage ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {showPollModal && activePollId !== item.pollId
                  ? 'Another poll is active'
                  : 'Tap to vote'
                }
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Time and status - aligned to right */}
          <View className="flex-row justify-end items-center mt-1">
            <Text
              className={`text-xs ${
                isOwnMessage ? "text-gray-600" : "text-gray-500"
              }`}
            >
              {formatISTTime(item.createdAt)}
            </Text>
            {isOwnMessage && (
              <View className="ml-1">
                <MessageStatus status={messageStatus} />
              </View>
            )}
            {/* Show edit indicator only once */}
            {item.isEdited && (
              <Text className={`text-xs italic ml-1 ${
                isOwnMessage ? "text-gray-600" : "text-gray-500"
              }`}>
                edited
              </Text>
            )}
          </View>
          </Animated.View>
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
            onInfoPress={handleInfoPress}
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
          data={(() => {
            // Sort messages by timestamp first (oldest to newest)
            const sortedMessages = [...messages].sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            
            // Group sorted messages by date
            const grouped = groupMessagesByDate(sortedMessages);
            
            // Get date keys and sort them chronologically
            const dateKeys = Object.keys(grouped);
            const sortedDateKeys = dateKeys.sort((a, b) => {
              // Get the first message from each date group to determine chronological order
              const firstMessageA = grouped[a][0];
              const firstMessageB = grouped[b][0];
              return new Date(firstMessageA.createdAt).getTime() - new Date(firstMessageB.createdAt).getTime();
            });
            
            const flatData: (Message | { type: 'date', date: string })[] = [];
            
            sortedDateKeys.forEach(date => {
              flatData.push({ type: 'date', date } as any);
              flatData.push(...grouped[date]);
            });
            
            return flatData;
          })()}
          keyExtractor={(item, index) => 
            item.type === 'date' ? `date-${item.date}` : item.id.toString()
          }
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return renderDateSeparator(item.date);
            }
            return renderMessage({ item: item as Message });
          }}
          contentContainerStyle={{ paddingVertical: 10 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
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
            // Scroll to end when content size changes (new messages) only if near bottom
            if (isNearBottom) {
              setTimeout(() => {
                if (flatListRef.current && messages.length > 0) {
                  // console.log("FlatList content size changed - scrolling to end");
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 100);
            }
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

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <TouchableOpacity
            onPress={scrollToBottom}
            className="absolute bottom-20 right-4 bg-blue-500 rounded-full p-3 shadow-lg"
            style={{ zIndex: 1000 }}
          >
            <Ionicons name="arrow-down" size={20} color="white" />
          </TouchableOpacity>
        )}

        {/* Reply preview - show above message input when replying */}
        {isReplying && replyToMessage && (isGroupAdmin || replyToMessage.senderId === currentUser?.userId) && (
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
          <View className="px-4 py-2 bg-white border-t border-gray-200">
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
              style={{ 
                borderTopWidth: 0, 
                borderTopColor: 'transparent', 
                backgroundColor: 'transparent',
                paddingHorizontal: 0
              }}
            />
          </View>
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

        {/* Read Status Modal */}
        <Modal
          visible={showReadStatus}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowReadStatus(false)}
        >
          <SafeAreaView className="flex-1 bg-white">
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
              <TouchableOpacity
                onPress={() => setShowReadStatus(false)}
                className="p-2"
              >
                <Ionicons name="arrow-back" size={24} color="#374151" />
              </TouchableOpacity>
              
              <Text className="text-lg font-semibold text-gray-900">Message Info</Text>
              
              <TouchableOpacity
                onPress={refreshReadStatus}
                disabled={isLoadingReadStatus}
                className="p-2"
              >
                <Ionicons 
                  name="refresh" 
                  size={24} 
                  color={isLoadingReadStatus ? "#9ca3af" : "#374151"} 
                />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4">
              {/* Message Preview */}
              {selectedMessageForReadStatus && (
                <View className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-600 mb-2">
                    {selectedMessageForReadStatus.senderName} • {formatISTDate(selectedMessageForReadStatus.createdAt)}
                  </Text>
                  <Text className="text-base text-gray-900" numberOfLines={3}>
                    {selectedMessageForReadStatus.messageText}
                  </Text>
                </View>
              )}

              {/* Read Status */}
              {isLoadingReadStatus ? (
                <View className="items-center py-8">
                  <ActivityIndicator size="large" color="#0284c7" />
                  <Text className="text-gray-500 mt-2">Loading read status...</Text>
                </View>
              ) : readStatusData ? (
                <View>
                  {/* Read by section */}
                  {readStatusData.readBy.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-lg font-semibold text-gray-900 mb-3">
                        Read by ({readStatusData.readBy.length})
                      </Text>
                      {readStatusData.readBy.map((user, index) => (
                        <View key={index} className="flex-row items-center justify-between py-2 border-b border-gray-100">
                          <Text className="text-gray-900">{user.fullName}</Text>
                          <Text className="text-sm text-gray-500">
                            {formatISTDate(user.readAt)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Unread by section */}
                  {readStatusData.unreadBy.length > 0 && (
                    <View>
                      <Text className="text-lg font-semibold text-gray-900 mb-3">
                        Unread by ({readStatusData.unreadBy.length})
                      </Text>
                      {readStatusData.unreadBy.map((user, index) => (
                        <View key={index} className="flex-row items-center py-2 border-b border-gray-100">
                          <Text className="text-gray-500">{user.fullName}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {readStatusData.readBy.length === 0 && readStatusData.unreadBy.length === 0 && (
                    <View className="items-center py-8">
                      <Ionicons name="information-circle-outline" size={48} color="#d1d5db" />
                      <Text className="text-gray-500 mt-2">No read status available</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View className="items-center py-8">
                  <Text className="text-gray-500">Failed to load read status</Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}