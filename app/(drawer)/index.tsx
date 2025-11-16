// app/(drawer)/index.tsx
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
  StatusBar,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname, useNavigation } from "expo-router";
import { fetchChatRooms } from "@/api/chat";
import { AuthStorage } from "@/utils/authStorage";
import { ChatRoom } from "@/types/type";
import { useFocusEffect } from "@react-navigation/native";
import socketService from "@/utils/socketService";
import { formatDistanceToNow } from "date-fns";
import eventEmitter from "@/utils/eventEmitter";
import { getRelativeTimeIST, formatISTTime } from "@/utils/dateUtils";
import { DrawerActions } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

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

export default function ChatRoomsScreen() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastMessages, setLastMessages] = useState<{
    [roomId: string]: LastMessageData;
  }>({});
  const [unreadCounts, setUnreadCounts] = useState<{
    [roomId: string]: number;
  }>({});
  const [appState, setAppState] = useState(AppState.currentState);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();
  const navigation = useNavigation();

  useEffect(() => {
    socketService.connect();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);

      if (appState.match(/inactive|background/) && nextAppState === "active") {
        loadRooms();

        if (!socketService.socket?.connected) {
          const socket = socketService.connect();
          if (socket && currentUserId) {
            socketService.identify(currentUserId);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appState, currentUserId]);

  useFocusEffect(
    useCallback(() => {
      loadRooms();

      const roomUpdateHandler = (data: RoomUpdateEvent) => {
        setLastMessages((prev) => ({
          ...prev,
          [data.roomId]: data.lastMessage,
        }));
        setUnreadCounts((prev) => ({
          ...prev,
          [data.roomId]: data.unreadCount,
        }));
      };

      const unreadUpdateHandler = (data: { roomId: string; count: number }) => {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.roomId]: data.count,
        }));
      };

      eventEmitter.on("roomUpdate", roomUpdateHandler);
      eventEmitter.on("unreadUpdate", unreadUpdateHandler);

      return () => {
        eventEmitter.off("roomUpdate", roomUpdateHandler);
        eventEmitter.off("unreadUpdate", unreadUpdateHandler);
      };
    }, [pathname])
  );

  useEffect(() => {
    const handleLastMessage = (data: LastMessageResponse) => {
      setLastMessages((prev) => ({
        ...prev,
        ...data.lastMessageByRoom,
      }));
    };

    const handleUnreadCounts = (data: UnreadCountsEvent) => {
      setUnreadCounts(data.unreadCounts);
    };

    const handleRoomUpdate = (data: RoomUpdateEvent) => {
      setLastMessages((prev) => ({
        ...prev,
        [data.roomId]: data.lastMessage,
      }));
      setUnreadCounts((prev) => ({
        ...prev,
        [data.roomId]: data.unreadCount,
      }));
    };

    const socket = socketService.socket;
    if (socket) {
      socket.on("lastMessage", handleLastMessage);
      socket.on("unreadCounts", handleUnreadCounts);
      socket.on("roomUpdate", handleRoomUpdate);
    }

    return () => {
      if (socket) {
        socket.off("lastMessage", handleLastMessage);
        socket.off("unreadCounts", handleUnreadCounts);
        socket.off("roomUpdate", handleRoomUpdate);
      }
    };
  }, []);

  const loadRooms = async () => {
    try {
      setIsLoading(true);
      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUserId(userData.userId);
        setIsAdmin(userData.isAdmin || false);

        socketService.identify(userData.userId);
        socketService.requestRoomData(userData.userId);
      }

      const chatRooms = await fetchChatRooms();
      setRooms(chatRooms);
    } catch (error) {
      console.error("Error loading rooms:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRooms();
  };

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const getLastMessagePreview = (roomId: number | string) => {
    const lastMessage = lastMessages[roomId.toString()];
    if (!lastMessage) return "No messages yet";

    const isOwnMessage = lastMessage.sender.userId === currentUserId;
    const senderPrefix = isOwnMessage ? "You: " : `${lastMessage.sender.userName}: `;

    if (lastMessage.messageType === "announcement") {
      try {
        const announcementData = JSON.parse(lastMessage.messageText);
        return `${senderPrefix}📢 ${announcementData.title || "Announcement"}`;
      } catch {
        return `${senderPrefix}📢 Announcement`;
      }
    } else if (lastMessage.messageType === "media") {
      return `${senderPrefix}📷 Media`;
    } else if (lastMessage.messageType === "audio") {
      return `${senderPrefix}🎵 Audio`;
    } else if (lastMessage.messageType === "poll") {
      return `${senderPrefix}📊 Poll`;
    } else if (lastMessage.messageType === "table") {
      return `${senderPrefix}📋 Table`;
    }

    return `${senderPrefix}${lastMessage.messageText || "Message"}`;
  };

  const getLastMessageTime = (roomId: number | string) => {
    const lastMessage = lastMessages[roomId.toString()];
    if (!lastMessage) return "";

    return getRelativeTimeIST(lastMessage.createdAt);
  };

  const getUnreadCount = (roomId: number | string) => {
    return unreadCounts[roomId.toString()] || 0;
  };

  const filteredRooms = rooms.filter((room) =>
    room.roomName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRoomItem = ({ item }: { item: ChatRoom }) => {
    const roomId = item.roomId ?? 0;
    const unreadCount = getUnreadCount(roomId);
    const lastMessagePreview = getLastMessagePreview(roomId);
    const lastMessageTime = getLastMessageTime(roomId);
    const firstLetter = item.roomName ? item.roomName.charAt(0).toUpperCase() : "?";

    return (
      <TouchableOpacity
        className="flex-row items-center p-4 bg-white border-b border-gray-100"
        onPress={() => router.push(`/chat/${roomId}`)}
      >
        <View className="w-14 h-14 bg-blue-500 rounded-full justify-center items-center mr-4">
          <Text className="text-white font-bold text-xl">{firstLetter}</Text>
        </View>
        
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-base font-semibold text-gray-900 flex-1" numberOfLines={1}>
              {item.roomName || "Unnamed Room"}
            </Text>
            {lastMessageTime && (
              <Text className="text-xs text-gray-500 ml-2">{lastMessageTime}</Text>
            )}
          </View>
          
          <View className="flex-row items-center justify-between">
            <Text
              className={`text-sm flex-1 ${
                unreadCount > 0 ? "text-gray-900 font-semibold" : "text-gray-600"
              }`}
              numberOfLines={1}
            >
              {lastMessagePreview}
            </Text>
            {unreadCount > 0 && (
              <View className="bg-blue-500 rounded-full min-w-[24px] h-6 justify-center items-center px-2 ml-2">
                <Text className="text-white text-xs font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
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
        
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0284c7" />
          <Text className="text-gray-500 mt-4">Loading chat rooms...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
      
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
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            className="flex-1 ml-2 text-base"
            placeholder="Search chat rooms..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chat Rooms List */}
      <FlatList
        data={filteredRooms}
        keyExtractor={(item) => (item.roomId ?? 0).toString()}
        renderItem={renderRoomItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0284c7"]}
            tintColor="#0284c7"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-8 mt-20">
            <Ionicons name="chatbubbles-outline" size={80} color="#d1d5db" />
            <Text className="text-gray-500 mt-4 text-center text-lg">
              {searchQuery
                ? "No chat rooms found"
                : "No chat rooms available"}
            </Text>
            {!searchQuery && (
              <Text className="text-gray-400 mt-2 text-center">
                Chat rooms will appear here once they are created
              </Text>
            )}
          </View>
        }
        className="flex-1"
      />

      {/* Create Room FAB - Only for admin/master */}
      {isAdmin && (
        <TouchableOpacity
          className="absolute bottom-6 right-6 w-16 h-16 bg-blue-600 rounded-full justify-center items-center shadow-lg"
          onPress={() => router.push("/chat/create-room")}
          style={{
            elevation: 8,
            shadowColor: "#0284c7",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

