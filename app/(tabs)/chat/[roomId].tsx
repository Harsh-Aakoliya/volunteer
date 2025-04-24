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
interface RoomDetails extends ChatRoom {
  members: ChatUser[];
  messages: Message[];
}

interface RoomMember extends ChatUser {
  isOnline?: boolean;
}

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams();
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [sending, setSending] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);

      // Collapse
      // When app comes to foreground, refresh data and reconnect socket if needed
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
    const socket = socketService.connect();

    return () => {
      // Clean up socket listeners when component unmounts
      socketService.removeListeners();
    };
  }, []);

  // Join room and set up socket event listeners
  // app/chat/[roomId].tsx - Update the useEffect for socket events
  useEffect(() => {
    if (roomId && currentUser) {
      // Keep track of received message IDs to prevent duplicates
      const receivedMessageIds = new Set();

      // Collapse
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
            console.log("Online users updated:", users);
            setOnlineUsers(users);
          }
        }
      );

      // Listen for room members updates
      socketService.onRoomMembers(({ roomId: updatedRoomId, members }) => {
        if (updatedRoomId === roomId) {
          console.log("Room members updated:", members);
          setRoomMembers(
            members.map((member) => ({
              ...member,
              fullName: member.fullName ?? undefined,
              isOnline: !!member.isOnline,
            }))
          );
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
              createdAt: data.createdAt,
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
    if (roomDetails) {
      // Set header options
      navigation.setOptions({
        title: roomDetails.roomName,
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
          ) : null,
      });
    }
  }, [roomDetails, isAdmin]);

  const loadRoomDetails = async () => {
    try {
      setIsLoading(true);

      // Collapse
      // Get current user
      const userData = await AuthStorage.getUser();
      setCurrentUser(userData);
      console.log("userdata is", userData);

      // Fetch room details
      const token = await AuthStorage.getToken();
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRoomDetails(response.data);
      setMessages(response.data.messages || []);

      // Check if current user is admin of this room
      const isUserAdmin = response.data.members.some(
        (member: ChatUser) =>
          member.userId === userData?.userId && member.isAdmin
      );
      setIsAdmin(isUserAdmin);
      console.log("is admin", isAdmin);

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

      // Reset unread count for this room
      // This would typically be done via an API call, but we'll use socket for now
      // The server will handle this when the user joins the room
    } catch (error) {
      console.error("Error loading room details:", error);
      alert("Failed to load chat room details");
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !roomId || !currentUser || sending) return;

    // Collapse
    // Declare trimmedMessage outside the try block so it's accessible in the catch block
    const trimmedMessage = messageText.trim();

    try {
      setSending(true);
      setMessageText(""); // Clear input immediately for better UX

      // Create optimistic message to show immediately
      const optimisticMessage: Message = {
        id: Date.now(), // Temporary ID
        roomId: parseInt(roomId as string),
        senderId: currentUser.userId,
        senderName: currentUser.fullName || "You",
        messageText: trimmedMessage,
        createdAt: new Date().toISOString(),
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
        { messageText: trimmedMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Replace optimistic message with the real one from the server
      const newMessage = {
        ...response.data,
        senderName: currentUser.fullName || "You",
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticMessage.id ? newMessage : msg))
      );

      // Send the message via socket for real-time delivery
      socketService.sendMessage(roomId as string, newMessage, {
        userId: currentUser.userId,
        userName: currentUser.fullName || "Anonymous",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");

      // Restore the message text if sending failed
      setMessageText(trimmedMessage);

      // Remove the optimistic message
      setMessages((prev) => prev.filter((msg) => typeof msg.id === "number"));
    } finally {
      setSending(false);
    }
  };

  // Update the renderMessage function in [roomId].tsx
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUser?.userId;

    // Determine message status
    let messageStatus: "sending" | "sent" | "delivered" | "read" | "error" =
      "sent";

    if (typeof item.id === "number") {
      messageStatus = "delivered"; // For messages with real IDs from the server
    } else if (typeof item.id === "string") {
      // Now TypeScript knows item.id can be a string
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
        <Text className={isOwnMessage ? "text-white" : "text-black"}>
          {item.messageText}
        </Text>
        <View className="flex-row justify-between items-center">
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

  if (!roomDetails) {
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
          totalCount={roomDetails.members.length}
          onPress={() => setShowMembersModal(true)}
        />

        {/* Collapse */}
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

        {/* Message input */}
        <View className="p-2 border-t border-gray-200 bg-white flex-row items-center">
          <TextInput
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />
          <TouchableOpacity
            className={`rounded-full p-2 ${
              messageText.trim() && !sending ? "bg-blue-500" : "bg-gray-300"
            }`}
            onPress={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {/* Members Modal */}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
