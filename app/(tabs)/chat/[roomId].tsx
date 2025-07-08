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

interface RoomDetails extends ChatRoom {
  members: ChatUser[];
  messages: Message[];
}

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams();
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    fullName: string | null;
  } | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<ChatUser[]>([]);
  const [appState, setAppState] = useState(AppState.currentState);

  const [showPollModel, setShowPollModel]=useState(false);
  const [pollId,setPollId]=useState<number |null>(null);

  const [showTableModle,setShowTableModel] =useState(false);
  const [tableId,setTableId]=useState<number | null>(null);

  // Media viewer modal states
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // Use a Set to track received message IDs to prevent duplicates
  const receivedMessageIds = new Set<string | number>();

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
        // Optional cleanup
      };
    }, [roomId])
  );

  useEffect(() => {
    if (room) {
      // Set header options
      navigation.setOptions({
        title: room.roomName,
        headerRight: () =>
          isAdmin ? (
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
  }, [room, isAdmin, navigation]);

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

      // Check if current user is admin of this room
      const isUserAdmin = response.data.members.some(
        (member: ChatUser) =>
          member.userId === userData?.userId && member.isAdmin
      );
      setIsAdmin(isUserAdmin);

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

  // Render message function to support media files
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUser?.userId;

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
      <View
        className={`p-2 max-w-[80%] rounded-lg my-1 ${
          isOwnMessage ? "bg-blue-500 self-end" : "bg-gray-200 self-start"
        }`}
      >
        {!isOwnMessage && (
          <Text className="text-xs font-bold text-gray-600">
            {item.senderName || "Unknown"}
          </Text>
        )}
        
        {item.messageText && (
          <Text className={isOwnMessage ? "text-white" : "text-black"}>
            {item.messageText}
          </Text>
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
        {/* Online users indicator - Now clickable */}
        <OnlineUsersIndicator
          onlineCount={onlineUsers.length}
          totalCount={roomMembers.length}
          onPress={() => setShowMembersModal(true)}
        />

        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 10 }}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-4 mt-10">
              <Ionicons name="chatbubble-outline" size={60} color="#d1d5db" />
              <Text className="text-gray-500 mt-4 text-center">
                No messages yet. Be the first to send a message!
              </Text>
            </View>
          }
        />

        {/* Optional Grid */}
        <View className="p-2 border-t border-gray-200 bg-white">
          <View className="flex-row items-center">
            <TouchableOpacity
              className="p-2"
              onPress={() => router.push({
                pathname: "/chat/Attechments-grid",
                params: { 
                  roomId, 
                  userId: currentUser?.userId
                }
              })}
            >
              <Ionicons name="add-circle" size={24} />
            </TouchableOpacity>
            
            {/* Input Bar */}
            <TextInput
              className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline={true}
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
        </View>

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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
