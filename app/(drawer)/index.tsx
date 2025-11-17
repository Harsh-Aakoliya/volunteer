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
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation, usePathname } from "expo-router";
import { fetchChatRooms } from "@/api/chat";
import { AuthStorage } from "@/utils/authStorage";
import { ChatRoom } from "@/types/type";
import { useFocusEffect } from "@react-navigation/native";
import socketService from "@/utils/socketService";
import { formatDistanceToNow } from "date-fns";
import eventEmitter from "@/utils/eventEmitter";
import { getRelativeTimeIST, formatISTTime } from "@/utils/dateUtils";
import { LinearGradient } from "expo-linear-gradient";

import { DrawerActions } from "@react-navigation/native";
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

interface UnreadCountsEvent {
  unreadCounts: {
    [roomId: string]: number;
  };
}

interface RoomUpdateEvent {
  roomId: string;
  lastMessage: LastMessageData;
  unreadCount: number;
}

interface ExtendedChatRoom extends ChatRoom {
  unreadCount?: number;
  lastMessage?: LastMessageData;
  onlineCount?: number;
}
interface MentionSegment {
  text: string;
  isMention: boolean;
  userId?: string;
  isCurrentUser?: boolean;
}

export default function ChatRooms() {
  const [chatRooms, setChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [filteredChatRooms, setFilteredChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMaster,setIsMaster] = useState(false);
  const [isAdmin,setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [lastMessages, setLastMessages] = useState<{ [key: string]: LastMessageData }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const pathname = usePathname();
  const navigation = useNavigation();
  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredChatRooms(chatRooms);
    } else {
      const filtered = chatRooms.filter(room =>
        room.roomName?.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredChatRooms(filtered);
    }
  };

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

  // Update rooms with last messages and unread counts
  const updateRoomsWithData = (
    rooms: ExtendedChatRoom[],
    lastMessagesData: { [key: string]: LastMessageData },
    unreadCountsData: { [key: string]: number }
  ) => {
    return rooms.map(room => {
      const roomIdStr = room.roomId?.toString();
      if (roomIdStr) {
        return {
          ...room,
          lastMessage: lastMessagesData[roomIdStr] || room.lastMessage,
          unreadCount: unreadCountsData[roomIdStr] || 0
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
        socket.off("unreadCounts");
        socket.off("roomUpdate");

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
              const updatedRooms = updateRoomsWithData(prevRooms, {
                ...lastMessages,
                ...data.lastMessageByRoom
              }, unreadCounts);
              const sortedRooms = sortRoomsByRecent(updatedRooms);
              console.log("✅ Updated rooms count:", sortedRooms.length);
              return sortedRooms;
            });
          }
        });

        // Set up unreadCounts listener
        socket.on("unreadCounts", (data: UnreadCountsEvent) => {
          console.log("📊 Received unreadCounts event:", data);

          if (data && data.unreadCounts) {
            // Update unreadCounts state
            setUnreadCounts(prevCounts => ({
              ...prevCounts,
              ...data.unreadCounts
            }));

            // Update chat rooms with new unread counts
            setChatRooms(prevRooms => {
              if (prevRooms.length === 0) {
                return prevRooms;
              }

              const updatedRooms = updateRoomsWithData(prevRooms, lastMessages, {
                ...unreadCounts,
                ...data.unreadCounts
              });
              return sortRoomsByRecent(updatedRooms);
            });
          }
        });

        // Set up roomUpdate listener for real-time updates
        socket.on("roomUpdate", (data: RoomUpdateEvent) => {
          console.log("🔄 Received roomUpdate event:", data);

          if (data && data.roomId) {
            const roomIdStr = data.roomId.toString();

            // Update both last messages and unread counts
            setLastMessages(prevMessages => ({
              ...prevMessages,
              [roomIdStr]: data.lastMessage
            }));

            setUnreadCounts(prevCounts => ({
              ...prevCounts,
              [roomIdStr]: data.unreadCount
            }));

            // Update chat rooms
            setChatRooms(prevRooms => {
              const updatedRooms = prevRooms.map(room => {
                if (room.roomId?.toString() === roomIdStr) {
                  return {
                    ...room,
                    lastMessage: data.lastMessage,
                    unreadCount: data.unreadCount
                  };
                }
                return room;
              });
              return sortRoomsByRecent(updatedRooms);
            });
          }
        });

        // Request room data after setting up listeners
        setTimeout(() => {
          socketService.requestRoomData(userData.userId);
        }, 10);

      } else {
        console.error("❌ Failed to connect socket");
      }
    } catch (error) {
      console.error("❌ Error initializing socket:", error);
    }
  }, [lastMessages, unreadCounts]);

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

      // Apply existing last messages and unread counts if available
      const roomsWithData = updateRoomsWithData(extendedRooms, lastMessages, unreadCounts);
      const sortedRooms = sortRoomsByRecent(roomsWithData);

      setChatRooms(sortedRooms);
      setFilteredChatRooms(sortedRooms);
      console.log("✅ Chat rooms loaded and sorted");

      // Check admin status
      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUser(userData);
        const adminStatus = userData?.role === 'admin' || false;
        const masterStatus = userData?.role === 'master' || false;
        setIsMaster(masterStatus);
        setIsAdmin(adminStatus);
      }

    } catch (error) {
      console.error("❌ Error loading chat rooms:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [lastMessages, unreadCounts]);

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  useEffect(() => {
    initializeSocket();

    // Listen for notification events to open specific chat rooms
    const handleOpenChatRoom = (data: { roomId: string }) => {
      const { roomId } = data;
      console.log('💬 Opening chat room from notification:', roomId);

      // Check if the room exists in our current room list
      const roomExists = chatRooms.some(room => room.roomId?.toString() === roomId);

      if (roomExists) {
        console.log('✅ Room found in list, navigating to:', roomId);
        router.push(`/chat/${roomId}`);
      } else {
        console.log('🔄 Room not found in list, refreshing rooms and then navigating...');
        // Refresh rooms first, then navigate
        loadChatRooms().then(() => {
          setTimeout(() => {
            router.push(`/chat/${roomId}`);
          }, 300);
        }).catch(error => {
          console.error('❌ Error refreshing chat rooms:', error);
          // Try to navigate anyway
          router.push(`/chat/${roomId}`);
        });
      }
    };

    // Add event listener for custom notification events using EventEmitter
    eventEmitter.on('openChatRoom', handleOpenChatRoom);

    // Cleanup
    return () => {
      eventEmitter.off('openChatRoom', handleOpenChatRoom);
    };
  }, [])

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

  // Main focus effect - runs when component comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("🎯 Chat routes focused");

      // Load rooms first
      loadChatRooms();

      // Then initialize socket (with a small delay to ensure rooms are loaded)
      const socketTimer = setTimeout(() => {
        initializeSocket();
      }, 1);

      // Notify server that user entered chat tab
      const notifyChatTabEntry = async () => {
        const userData = await AuthStorage.getUser();
        if (userData && socketService.socket?.connected) {
          socketService.enterChatTab(userData.userId);
        }
      };

      const notifyTimer = setTimeout(notifyChatTabEntry, 1500);

      return () => {
        console.log("🧹 Chat routes unfocused, cleaning up");
        clearTimeout(socketTimer);
        clearTimeout(notifyTimer);

        // Notify server that user left chat tab
        const notifyChatTabExit = async () => {
          const userData = await AuthStorage.getUser();
          if (userData && socketService.socket?.connected) {
            socketService.leaveChatTab(userData.userId);
          }
        };
        notifyChatTabExit();

        // Don't disconnect socket completely, just remove listeners
        if (socketService.socket) {
          socketService.socket.off("lastMessage");
          socketService.socket.off("unreadCounts");
          socketService.socket.off("roomUpdate");
        }
      };
    }, []) // Empty dependency array is intentional
  );

  // Effect to update rooms when lastMessages or unreadCounts change
  useEffect(() => {
    if ((Object.keys(lastMessages).length > 0 || Object.keys(unreadCounts).length > 0) && chatRooms.length > 0) {
      console.log("🔄 Room data updated, refreshing room list");
      setChatRooms(prevRooms => {
        const updatedRooms = updateRoomsWithData(prevRooms, lastMessages, unreadCounts);
        const sortedRooms = sortRoomsByRecent(updatedRooms);

        // Update filtered rooms based on current search query
        if (searchQuery.trim() === '') {
          setFilteredChatRooms(sortedRooms);
        } else {
          const filtered = sortedRooms.filter(room =>
            room.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setFilteredChatRooms(filtered);
        }

        return sortedRooms;
      });
    }
  }, [lastMessages, unreadCounts]);

  const onRefresh = useCallback(() => {
    console.log("🔄 Manual refresh triggered");
    setRefreshing(true);

    // Reload rooms and reinitialize socket
    loadChatRooms();
    initializeSocket();
  }, [loadChatRooms, initializeSocket]);

  const navigateToChatRoom = (roomId: string) => {
    // Clear unread count for this room when navigating
    setChatRooms((prevRooms) => {
      const updatedRooms = prevRooms.map((room) => {
        if (room.roomId?.toString() === roomId) {
          return { ...room, unreadCount: 0 };
        }
        return room;
      });

      // Update filtered rooms based on current search query
      if (searchQuery.trim() === '') {
        setFilteredChatRooms(updatedRooms);
      } else {
        const filtered = updatedRooms.filter(room =>
          room.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredChatRooms(filtered);
      }

      return updatedRooms;
    });

    // Also update local unread counts
    setUnreadCounts(prev => ({
      ...prev,
      [roomId]: 0
    }));

    router.push({
      pathname: "/chat/[roomId]",
      params: { roomId },
    });
  };

  const formatMessageTime = (timestamp: string) => {
    if (!timestamp) return "";

    try {
      return getRelativeTimeIST(timestamp);
    } catch (error) {
      console.error("Error formatting time:", error);
      return "";
    }
  };
  // Parse message text to identify mentions
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
      const roomMembers: any = [];//lets fix this later
      const mentionedUser = roomMembers.find((member: any) =>
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

  const renderChatRoomItem = ({ item }: { item: ExtendedChatRoom }) => {
    const RoomItem = () => {
      let messagePreview = "";

      if (item.lastMessage) {
        const senderPrefix =
          item.lastMessage.sender.userId === currentUser?.userId
            ? "You: "
            : `${item.lastMessage.sender.userName}: `;

        // Handle different message types
        if (item.lastMessage.messageType === "text" && item.lastMessage.messageText) {
          messagePreview = senderPrefix + item.lastMessage.messageText;
        } else if (item.lastMessage.pollId) {
          messagePreview = senderPrefix + "shared a poll";
        } else if (item.lastMessage.tableId) {
          messagePreview = senderPrefix + "shared a table";
        } else if (item.lastMessage.mediaFilesId) {
          messagePreview = senderPrefix + "shared media";
        } else {
          messagePreview = senderPrefix + "sent a message";
        }
      } else if (item.roomDescription) {
        messagePreview = item.roomDescription;
      } else {
        messagePreview = "No messages yet";
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

      // Define colors based on unread status
      const backgroundColor = hasUnread ? "bg-white" : "bg-gray-50";
      const roomNameColor = hasUnread ? "text-gray-900" : "text-gray-700";
      const messageColor = hasUnread ? "text-gray-700" : "text-gray-500";
      const timeColor = hasUnread ? "text-gray-600" : "text-gray-400";
      const borderColor = hasUnread ? "border-gray-200" : "border-gray-100";

      return (
        <TouchableOpacity
          className={`${backgroundColor} p-4 border-b ${borderColor}`}
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
                <Text className={`text-lg font-bold ${roomNameColor}`}>
                  {item.roomName}
                </Text>
                {timeText ? (
                  <Text className={`text-xs ${timeColor}`}>{timeText}</Text>
                ) : null}
              </View>

              <View className="flex-row justify-between items-center mt-1">
                <Text
                  className={`flex-1 text-sm mr-2 ${messageColor}`}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {renderMessageTextWithMentions(messagePreview)}
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
      {/* Header */}
      <LinearGradient
        colors={["#6366f1", "#8b5cf6", "#a855f7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="flex-row items-center justify-between h-[60px] px-4"
        style={{
          elevation: 8,
          shadowColor: "#6366f1",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }}
      >
        <TouchableOpacity onPress={openDrawer} className="p-1">
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <Text className="text-[22px] font-bold text-white tracking-wide">
            Sevak App
          </Text>
        </View>

        <View className="w-[38px]" />
      </LinearGradient>
      {/* Search Bar */}
      <View className="p-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3">
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            placeholder="Search chat rooms..."
            className="flex-1 ml-3 text-gray-800"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredChatRooms}
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
              {searchQuery.length > 0
                ? "No chat rooms match your search."
                : "No chat rooms available."}
              {!searchQuery && (isAdmin || isMaster) ? " Create one by tapping the + button." : ""}
            </Text>
          </View>
        )}
      />
      {(isAdmin || isMaster) && (
        <TouchableOpacity
          onPress={() => router.push("/chat/create-room")}
          className="absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          style={{ elevation: 8 }}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}


