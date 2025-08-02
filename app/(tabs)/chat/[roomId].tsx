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
} from "react-native";
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
import RenderPoll from "@/components/chat/Attechments/RenderPoll";
import RenderDriveFiles from "@/components/chat/RenderDriveFiles";
import RenderTable from "@/components/chat/Attechments/RenderTable";
import MediaViewerModal from "@/components/chat/MediaViewerModal";
import ChatMessageOptions from "@/components/chat/ChatMessageOptions";
import ForwardMessagesModal from "@/components/chat/ForwardMessagesModal";
import AttachmentsGrid from "./Attechments-grid";

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

  const [showPollModel, setShowPollModel]=useState(false);
  const [pollId,setPollId]=useState<number |null>(null);

  const [showTableModle,setShowTableModel] =useState(false);
  const [tableId,setTableId]=useState<number | null>(null);

  // Media viewer modal states
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);

  // Attachments grid state
  const [showAttachmentsGrid, setShowAttachmentsGrid] = useState(false);

  // Mention feature states
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [filteredMembers, setFilteredMembers] = useState<ChatUser[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  // Use a Set to track received message IDs to prevent duplicates
  const receivedMessageIds = new Set<string | number>();

  // Handle keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        if (showAttachmentsGrid) {
          setShowAttachmentsGrid(false);
        }
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
    };
  }, [showAttachmentsGrid]);

  // Handle attachments grid toggle
  const toggleAttachmentsGrid = () => {
    if (showAttachmentsGrid) {
      // Hide attachments grid and show keyboard
      setShowAttachmentsGrid(false);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    } else {
      // Show attachments grid and hide keyboard
      Keyboard.dismiss();
      setShowAttachmentsGrid(true);
    }
  };

  // Handle mention functionality
  const handleTextChange = (text: string) => {
    setMessageText(renderMessageText(text).join(""));
    
    // Find the last @ symbol before cursor position
    const beforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Check if there's a space after the @ symbol and before cursor
      const afterAt = beforeCursor.substring(lastAtIndex + 1);
      const hasSpaceAfterAt = afterAt.includes(' ');
      
      if (!hasSpaceAfterAt) {
        // Extract the search term after @
        const searchTerm = afterAt.toLowerCase();
        setMentionSearch(searchTerm);
        setMentionStartIndex(lastAtIndex);
        
        // Filter members based on search term (show all if searchTerm is empty)
        const filtered = roomMembers.filter(member => 
          searchTerm === '' || member.fullName?.toLowerCase().startsWith(searchTerm) || false
        );
        
        setFilteredMembers(filtered);
        setShowMentionMenu(filtered.length > 0);
      } else {
        setShowMentionMenu(false);
      }
    } else {
      setShowMentionMenu(false);
    }
  };

  const handleSelectionChange = (event: any) => {
    setCursorPosition(event.nativeEvent.selection.start);
  };

  const selectMention = (member: ChatUser) => {
    if (mentionStartIndex === -1 || !member.fullName) return;
    console.log(mentionStartIndex);
    const beforeMention = messageText.substring(0, mentionStartIndex);
    const afterMention = messageText.substring(mentionStartIndex + mentionSearch.length + 1);
    console.log("before mention",beforeMention);
    console.log("after mention",afterMention);
    const newText = `${beforeMention.slice(0,-1)}<Text>${member.fullName}</Text> ${afterMention}`;
    setMessageText(renderMessageText(newText).join(""));
    setShowMentionMenu(false);
    
    // Set cursor position after the mention
    const newCursorPosition = mentionStartIndex + member.fullName.length + 13;
    setTimeout(() => {
      setCursorPosition(newCursorPosition);
      textInputRef.current?.setNativeProps({
        selection: { start: newCursorPosition, end: newCursorPosition }
      });
    }, 10);
  };

  // Parse message text to identify mentions
  const parseMessageText = (text: string): MentionSegment[] => {
    const segments: MentionSegment[] = [];
    const mentionRegex = /<Text>([^<]+)<\/Text>/g;
    let lastIndex = 0;
    let match:any;
  
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
    console.log(segments);
  
    return segments;
  };

  // Render mention menu
  const renderMentionMenu = () => {
    if (!showMentionMenu || filteredMembers.length === 0) return null;
  
    return (
      <View className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 mb-2">
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filteredMembers.map((member) => (
            <TouchableOpacity
              key={member.userId}
              onPress={() => selectMention(member)}
              className="p-3 border-b border-gray-100 flex-row items-center"
            >
              <View className="w-8 h-8 bg-blue-500 rounded-full justify-center items-center mr-3">
                <Text className="text-white font-bold text-sm">
                  {member.fullName?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <Text className="text-gray-800 font-medium">{member.fullName}</Text>
              {member.isOnline && (
                <View className="w-2 h-2 bg-green-500 rounded-full ml-auto" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
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

  //Render whatever is user is writting in text input box
  const renderMessageText = (text: string) => {
    const segments = parseMessageText(text);
    
    return (
        segments.map((segment, index) => (
          segment.isMention ? "@"+segment.text : segment.text
        ))
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
            setMessages((prev) => [...prev, newMessage]);

            // Scroll to bottom when new message arrives
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
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
          ) : (
            <TouchableOpacity
              onPress={() => setShowMembersModal(true)}
              className="mr-2"
            >
              <Ionicons name="people" size={24} color="#0284c7" />
            </TouchableOpacity>
          ),
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
    tableId?: number
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
      setShowMentionMenu(false); // Hide mention menu

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
        tableId: tableId
      };

      // Add optimistic message to the list
      setMessages((prev) => [...prev, optimisticMessage]);

      // Scroll to the bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
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
          tableId: tableId
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
        return [...filteredMessages, ...messagesWithSenderName];
      });

      // Send the messages via socket for real-time delivery
      messagesWithSenderName.forEach(newMessage => {
        socketService.sendMessage(roomId as string, newMessage, {
          userId: currentUser.userId,
          userName: currentUser.fullName || "Anonymous",
        });
      });
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

    return (
      <View className="relative">
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
              isOwnMessage ? "bg-blue-200 self-end" : "bg-gray-200 self-start"
            }`}
            style={{ zIndex: 2 }}
          >
          {!isOwnMessage && (
            <Text className="text-xs font-bold text-gray-600">
              {item.senderName || "Unknown"}
            </Text>
          )}
          
          {item.messageText && (
            <View className={isOwnMessage ? "text-white" : "text-black"}>
              {renderMessageTextWithMentions(item.messageText)}
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
                  setPollId(item.pollId);
                  setShowPollModel(true);
                }
              }}
            >
              <Text>Vote Now</Text>
            </TouchableOpacity>
          ) : null}

          {showPollModel && pollId !== null && currentUser?.userId && (
            <RenderPoll
              pollid={pollId} 
              setShowPollModel={setShowPollModel} 
              currentUserId={currentUser?.userId}
              totalMembers={roomMembers.length}
              visible={showPollModel}
            />
          )}

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
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-4 mt-10">
              <Ionicons name="chatbubble-outline" size={60} color="#d1d5db" />
              <Text className="text-gray-500 mt-4 text-center">
                No messages yet. {isGroupAdmin ? "Be the first to send a message!" : "Only group admins can send messages in this room."}
              </Text>
            </View>
          }
        />

        {/* Message input - Only show for group admins */}
        {isGroupAdmin && (
          <View className="border-t border-gray-200 bg-white">
            {/* Mention Menu */}
            {showMentionMenu && (
              <View className="p-2">
                {renderMentionMenu()}
              </View>
            )}
            
            <View className="flex-row items-center p-2">
              <TouchableOpacity
                className="p-2"
                onPress={toggleAttachmentsGrid}
              >
                <Ionicons 
                  name={showAttachmentsGrid ? "close-circle" : "add-circle"} 
                  size={24} 
                  color={showAttachmentsGrid ? "#ef4444" : "#6b7280"} 
                />
              </TouchableOpacity>
              
              {/* Input Bar */}
              <TextInput
                ref={textInputRef}
                className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
                placeholder="Type a message..."
                value={messageText}
                onChangeText={handleTextChange}
                onSelectionChange={handleSelectionChange}
                multiline={true}
                onFocus={() => {
                  if (showAttachmentsGrid) {
                    setShowAttachmentsGrid(false);
                  }
                }}
              />
              
              <TouchableOpacity
                className={`rounded-full p-2 ${
                  messageText.trim() && !sending
                    ? "bg-blue-500"
                    : "bg-gray-300"
                }`}
                onPress={() => sendMessage(messageText, "text")}
                disabled={!messageText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={24} color="white" />
                )}
              </TouchableOpacity>
            </View>

            {/* Attachments Grid */}
            {showAttachmentsGrid && (
              <View className="border-t border-gray-200 bg-gray-50 p-4">
                <AttachmentsGrid 
                  roomId={roomId as string} 
                  userId={currentUser?.userId || ""} 
                  onOptionSelect={() => setShowAttachmentsGrid(false)}
                />
              </View>
            )}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}