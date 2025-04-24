// app/chat/index.tsx
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

// Extended ChatRoom type with unread count and last message
interface ExtendedChatRoom extends ChatRoom {
  unreadCount?: number;
  lastMessage?: {
    messageText: string;
    createdAt: string;
    sender: {
      userId: string;
      userName: string;
    };
  };
  onlineCount?: number;
}

export default function ChatRooms() {
  const [chatRooms, setChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const pathname = usePathname(); // Add this hook to get the current path
  // Sort rooms by most recent activity
  const sortRoomsByRecent = (rooms: ExtendedChatRoom[]) => {
    return [...rooms].sort((a, b) => {
      // If a room has a last message, use its timestamp for sorting
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

      return bTime - aTime; // Most recent first
    });
  };

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);

      // Collapse
      // When app comes to foreground, refresh rooms and reconnect socket if needed
      if (appState.match(/inactive|background/) && nextAppState === "active") {
        loadChatRooms();

        // Ensure socket is connected
        if (!socketService.socket?.connected) {
          const socket = socketService.connect();
          if (socket && currentUser) {
            socketService.identify(currentUser.userId);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appState, currentUser]);

  // Connect to socket and set up event listeners
  useEffect(() => {
    const initializeSocket = async () => {
      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUser(userData);
        const socket = socketService.connect();
        if (socket) {
          socketService.identify(userData.userId);

          // Collapse
          // Listen for room updates (new messages, etc.)
          socketService.onRoomUpdate((data) => {
            console.log("Room update received:", data);
            setChatRooms((prevRooms) => {
              const updatedRooms = prevRooms.map((room) => {
                if (room.roomId?.toString() === data.roomId) {
                  return {
                    ...room,
                    lastMessage: data.lastMessage,
                    unreadCount: data.unreadCount,
                  };
                }
                return room;
              });

              return sortRoomsByRecent(updatedRooms);
            });
          });

          // Listen for unread message updates
          // Listen for unread message updates
          socketService.onUnreadMessages((data) => {
            console.log("Unread messages update received:", data);
            setChatRooms((prevRooms) => {
              const updatedRooms = prevRooms.map((room) => {
                if (room.roomId?.toString() === data.roomId) {
                  return {
                    ...room,
                    unreadCount: data.count, // Use the count directly from the server
                    lastMessage: data.lastMessage,
                  };
                }
                return room;
              });

              return sortRoomsByRecent(updatedRooms);
            });
          });

          // Listen for new messages (to update room order)
          socketService.onNewMessage((data) => {
            // Only update if we're not in the specific room
            // (room-specific updates are handled in the room component)
            if (!pathname.includes(`/chat/${data.roomId}`)) {
              console.log("New message received while not in room:", data);
              setChatRooms((prevRooms) => {
                const updatedRooms = prevRooms.map((room) => {
                  if (room.roomId?.toString() === data.roomId) {
                    // Update the room with new message data
                    return {
                      ...room,
                      lastMessage: {
                        messageText: data.messageText,
                        createdAt: data.createdAt,
                        sender: data.sender,
                      },
                      // Only increment unread count if the message is not from the current user
                      unreadCount:
                        data.sender.userId !== currentUser?.userId
                          ? (room.unreadCount || 0) + 1
                          : room.unreadCount || 0,
                    };
                  }
                  return room;
                });

                // Sort rooms by most recent activity
                return sortRoomsByRecent(updatedRooms);
              });
            }
          });

          // Listen for online users updates
          socketService.onOnlineUsers(({ roomId, onlineUsers }) => {
            console.log("Online users update received:", roomId, onlineUsers);
            setChatRooms((prevRooms) => {
              return prevRooms.map((room) => {
                if (room.roomId?.toString() === roomId) {
                  return { ...room, onlineCount: onlineUsers.length };
                }
                return room;
              });
            });
          });
        }
      }
    };

    initializeSocket();

    return () => {
      // Clean up socket listeners when component unmounts
      socketService.removeListeners();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChatRooms();
    }, [])
  );

  const loadChatRooms = async () => {
    try {
      setIsLoading(true);
      const rooms = await fetchChatRooms();

      // Collapse
      // Get unread counts and last messages from server
      // This would typically come from your API, but for now we'll initialize with empty values
      const extendedRooms: ExtendedChatRoom[] = rooms.map((room) => ({
        ...room,
        unreadCount: 0,
        lastMessage: undefined,
        onlineCount: 0,
      }));

      // Sort rooms by most recent activity
      const sortedRooms = sortRoomsByRecent(extendedRooms);
      setChatRooms(sortedRooms);

      // Check admin status
      const userData = await AuthStorage.getUser();
      setCurrentUser(userData);
      const adminStatus = userData?.isAdmin || false;
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error("Error loading chat rooms:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChatRooms();
  }, []);

  const navigateToChatRoom = (roomId: string) => {
    // Reset unread count for this room when navigating to it
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

  // Format the time of the last message
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
    // Create a component that we'll return
    const RoomItem = () => {
      // Prepare the message preview text
      let messagePreview = "";
      if (item.lastMessage) {
        const senderPrefix =
          item.lastMessage.sender.userId === currentUser?.userId
            ? "You: "
            : `${item.lastMessage.sender.userName}`;
        messagePreview = senderPrefix + item.lastMessage.messageText;
      } else if (item.roomDescription) {
        messagePreview = item.roomDescription;
      }

      // Collapse
      // Prepare the time text
      const timeText = item.lastMessage
        ? formatMessageTime(item.lastMessage.createdAt)
        : "";

      // Prepare the unread count
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

              {/* Online indicator */}
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

                {/* Last message time */}
                {timeText ? (
                  <Text className="text-xs text-gray-500">{timeText}</Text>
                ) : null}
              </View>

              {/* Message preview and unread count */}
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

    // Return the component
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
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}
