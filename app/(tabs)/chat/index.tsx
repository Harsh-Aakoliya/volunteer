// app/chat/index.tsx - Fixed version
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { fetchChatRooms } from "@/api/chat";
import { AuthStorage } from "@/utils/authStorage";
import { ChatRoom } from "@/types/type";
import { useFocusEffect } from "@react-navigation/native";
import socketService from "@/utils/socketService";
import { formatDistanceToNow } from "date-fns";

interface LastMessageResponse {
  lastMessageByRoom: {
    [roomId: string]: LastMessageData;
  };
}

interface LastMessageData {
  createdAt: string;
  id: number;
  mediaFilesId: number | null;
  messageText: string;
  messageType: string;
  pollId: number | null;
  sender: {
    userId: string;
    userName: string;
  };
  tableId: number | null;
}

interface ExtendedChatRoom extends ChatRoom {
  unreadCount?: number;
  lastMessage?: LastMessageData;
  onlineCount?: number;
}

export default function ChatRooms() {
  const [chatRooms, setChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [lastMessages, setLastMessages] = useState<{ [key: string]: LastMessageData }>({});
  const pathname = usePathname();

  // Sort rooms by most recent activity
  const sortRoomsByRecent = (rooms: ExtendedChatRoom[]) => {
    return [...rooms].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : a.createdOn
          ? new Date(a.createdOn).getTime()
          : 0;

      const bTime = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : b.createdOn
          ? new Date(b.createdOn).getTime()
          : 0;

      return bTime - aTime;
    });
  };

  // Update rooms with last messages
  const updateRoomsWithLastMessages = (rooms: ExtendedChatRoom[], lastMessagesData: { [key: string]: LastMessageData }) => {
    return rooms.map(room => {
      const roomIdStr = room.roomId?.toString();
      if (roomIdStr && lastMessagesData[roomIdStr]) {
        return {
          ...room,
          lastMessage: lastMessagesData[roomIdStr]
        };
      }
      return room;
    });
  };

  // Initialize socket and setup listeners
  const initializeSocket = useCallback(async () => {
    console.log("🔌 Initializing socket connection...");

    try {
      const userData = await AuthStorage.getUser();
      if (!userData) {
        console.log("❌ No user data found");
        return;
      }

      setCurrentUser(userData);

      // Always connect/reconnect socket
      const socket = socketService.connect();
      if (socket) {
        console.log("✅ Socket connected, identifying user:", userData.userId);
        socketService.identify(userData.userId);

        // Clear existing listeners to prevent duplicates
        socket.off("lastMessage");

        // Set up lastMessage listener
        socket.on("lastMessage", (data: LastMessageResponse) => {
          console.log("📨 Received lastMessage event:", data);

          if (data && data.lastMessageByRoom) {
            console.log("📋 Updating last messages:", Object.keys(data.lastMessageByRoom));

            // Update lastMessages state
            setLastMessages(prevMessages => ({
              ...prevMessages,
              ...data.lastMessageByRoom
            }));

            // Update chat rooms with new last messages
            setChatRooms(prevRooms => {
              if (prevRooms.length === 0) {
                console.log("⚠️ No rooms to update yet");
                return prevRooms;
              }

              console.log("🔄 Updating chat rooms with last messages");
              const updatedRooms = updateRoomsWithLastMessages(prevRooms, {
                ...lastMessages,
                ...data.lastMessageByRoom
              });
              const sortedRooms = sortRoomsByRecent(updatedRooms);
              console.log("✅ Updated rooms count:", sortedRooms.length);
              return sortedRooms;
            });
          }
        });

        // Request current last messages from server
        // console.log("📤 Requesting last messages from server...");
        // socket.emit("requestLastMessages");

      } else {
        console.error("❌ Failed to connect socket");
      }
    } catch (error) {
      console.error("❌ Error initializing socket:", error);
    }
  }, [lastMessages]);

  // Load chat rooms and apply last messages
  const loadChatRooms = useCallback(async () => {
    try {
      console.log("📥 Loading chat rooms...");
      setIsLoading(true);

      const rooms = await fetchChatRooms();
      console.log("📋 Fetched rooms:", rooms.length);

      const extendedRooms: ExtendedChatRoom[] = rooms.map((room) => ({
        ...room,
        unreadCount: 0,
        lastMessage: undefined,
        onlineCount: 0,
      }));

      // Apply existing last messages if available
      const roomsWithLastMessages = updateRoomsWithLastMessages(extendedRooms, lastMessages);
      const sortedRooms = sortRoomsByRecent(roomsWithLastMessages);

      setChatRooms(sortedRooms);
      console.log("✅ Chat rooms loaded and sorted");

      // Check admin status
      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUser(userData);
        const adminStatus = userData?.isAdmin || false;
        setIsAdmin(adminStatus);
      }

    } catch (error) {
      console.error("❌ Error loading chat rooms:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [lastMessages]);
  useEffect(() => {
    initializeSocket();
  },[])
  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);

      if (appState.match(/inactive|background/) && nextAppState === "active") {
        console.log("📱 App came to foreground, refreshing...");
        loadChatRooms();
        initializeSocket();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appState, currentUser, loadChatRooms, initializeSocket]);
  // initializeSocket();

  // Main focus effect - runs when component comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("🎯 Chat routes focused");

      // Load rooms first
      loadChatRooms();

      // Then initialize socket (with a small delay to ensure rooms are loaded)
      const socketTimer = setTimeout(() => {
        initializeSocket();
      }, 100);

      return () => {
        console.log("🧹 Chat routes unfocused, cleaning up");
        clearTimeout(socketTimer);
        // Don't disconnect socket completely, just remove listeners
        if (socketService.socket) {
          socketService.socket.off("lastMessage");
        }
      };
    }, []) // Empty dependency array is intentional
  );

  // Effect to update rooms when lastMessages change
  useEffect(() => {
    if (Object.keys(lastMessages).length > 0 && chatRooms.length > 0) {
      console.log("🔄 LastMessages updated, refreshing room list");
      setChatRooms(prevRooms => {
        const updatedRooms = updateRoomsWithLastMessages(prevRooms, lastMessages);
        return sortRoomsByRecent(updatedRooms);
      });
    }
  }, [lastMessages]);

  const onRefresh = useCallback(() => {
    console.log("🔄 Manual refresh triggered");
    setRefreshing(true);

    // Reload rooms and reinitialize socket
    loadChatRooms();
    initializeSocket();
  }, [loadChatRooms, initializeSocket]);

  const navigateToChatRoom = (roomId: string) => {
    setChatRooms((prevRooms) => {
      return prevRooms.map((room) => {
        if (room.roomId?.toString() === roomId) {
          return { ...room, unreadCount: 0 };
        }
        return room;
      });
    });

    router.push({
      pathname: "/chat/[roomId]",
      params: { roomId },
    });
  };

  const formatMessageTime = (timestamp: string) => {
    if (!timestamp) return "";

    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      console.error("Error formatting time:", error);
      return "";
    }
  };

  const renderChatRoomItem = ({ item }: { item: ExtendedChatRoom }) => {
    const RoomItem = () => {
      let messagePreview = "";
      if (item.lastMessage) {
        const senderPrefix =
          item.lastMessage.sender.userId === currentUser?.userId
            ? "You: "
            : `${item.lastMessage.sender.userName}: `;
        messagePreview = senderPrefix + item.lastMessage.messageText;
      } else if (item.roomDescription) {
        messagePreview = item.roomDescription;
      }

      const timeText = item.lastMessage
        ? formatMessageTime(item.lastMessage.createdAt)
        : "";

      const hasUnread = item.unreadCount && item.unreadCount > 0;
      const unreadText = hasUnread
        ? (item.unreadCount ?? 0) > 99
          ? "99+"
          : (item.unreadCount ?? 0).toString()
        : "";

      return (
        <TouchableOpacity
          className="bg-white p-4 border-b border-gray-200"
          onPress={() => {
            if (item.roomId !== undefined) {
              navigateToChatRoom(item.roomId.toString());
            } else {
              console.error("Chat room ID is undefined:", item);
              alert("Cannot open this chat room. ID is missing.");
            }
          }}
        >
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-blue-100 rounded-full justify-center items-center mr-3 relative">
              <Ionicons
                name={item.isGroup ? "people" : "person"}
                size={24}
                color="#0284c7"
              />

              {item.onlineCount && item.onlineCount > 0 ? (
                <View className="absolute top-0 right-0 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {item.onlineCount}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="flex-1">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-bold">{item.roomName}</Text>
                {timeText ? (
                  <Text className="text-xs text-gray-500">{timeText}</Text>
                ) : null}
              </View>

              <View className="flex-row justify-between items-center mt-1">
                <Text
                  className="flex-1 text-gray-600 text-sm mr-2"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {messagePreview}
                </Text>

                {hasUnread ? (
                  <View className="bg-blue-500 rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    <Text className="text-white text-xs font-bold">
                      {unreadText}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

    return <RoomItem />;
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={chatRooms}
        keyExtractor={(item) =>
          item.roomId?.toString() || Math.random().toString()
        }
        renderItem={renderChatRoomItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0284c7"]}
          />
        }
        ListEmptyComponent={() => (
          <View className="flex-1 justify-center items-center p-4 mt-10">
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={60}
              color="#d1d5db"
            />
            <Text className="text-gray-500 mt-4 text-center">
              {"No chat rooms available."}
              {isAdmin ? " Create one by tapping the + button." : ""}
            </Text>
          </View>
        )}
      />

      {isAdmin && (
        <TouchableOpacity
          className="absolute bottom-6 right-6 bg-blue-500 p-4 rounded-full shadow-lg"
          onPress={() => router.push("/chat/create-room")}
        >
          <Ionicons name="add" color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}