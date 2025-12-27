// app/(drawer)/index.tsx
// Chat Rooms List - Clean implementation

import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { fetchChatRooms } from "@/api/chat";
import { ChatRoomStorage } from "@/utils/chatRoomsStorage";
import { ChatRoom } from "@/types/type";
import { useFocusEffect } from "@react-navigation/native";
import { getRelativeTimeIST } from "@/utils/dateUtils";
import { LinearGradient } from "expo-linear-gradient";
import { DrawerActions } from "@react-navigation/native";
import NoChatRoomComponenet from "@/components/chat/NoChatRoomComponenet";
import { useSocket, useRoomListSubscription } from "@/contexts/SocketContext";
import { LastMessage, RoomUpdate, OnlineUsersUpdate, ChatMessage, MessageEditedEvent, MessagesDeletedEvent } from "@/utils/socketManager";
import eventEmitter from "@/utils/eventEmitter";

// ==================== TYPES ====================

interface RoomListItem extends ChatRoom {
  unreadCount: number;
  lastMessage?: LastMessage;
  onlineCount: number;
}

// ==================== ROOM ITEM COMPONENT ====================

interface RoomItemProps {
  room: RoomListItem;
  currentUserId: string | undefined;
  onPress: (roomId: string) => void;
}

const RoomItem = memo(({ room, currentUserId, onPress }: RoomItemProps) => {
  const hasUnread = room.unreadCount > 0;
  
  // Format message preview
  let messagePreview = "No messages yet";
  if (room.lastMessage) {
    const isOwn = room.lastMessage.sender.userId === currentUserId;
    const prefix = isOwn ? "You: " : `${room.lastMessage.sender.userName}: `;
    
    if (room.lastMessage.messageText) {
      messagePreview = prefix + room.lastMessage.messageText;
    } else if (room.lastMessage.pollId) {
      messagePreview = prefix + "shared a poll";
    } else if (room.lastMessage.tableId) {
      messagePreview = prefix + "shared a table";
    } else if (room.lastMessage.mediaFilesId) {
      messagePreview = prefix + "shared media";
    } else {
      messagePreview = prefix + "sent a message";
    }
  } else if (room.roomDescription) {
    messagePreview = room.roomDescription;
  }

  // Format time
  let timeText = "";
  if (room.lastMessage?.createdAt) {
    try {
      timeText = getRelativeTimeIST(room.lastMessage.createdAt);
    } catch {}
  }

  return (
    <TouchableOpacity
      className={`p-4 border-b ${hasUnread ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"}`}
      activeOpacity={0.7}
      onPress={() => room.roomId && onPress(room.roomId.toString())}
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 bg-blue-100 rounded-full justify-center items-center mr-3">
          <Ionicons
            name={room.isGroup ? "people" : "person"}
            size={24}
            color="#0284c7"
          />
        </View>

        <View className="flex-1">
          <View className="flex-row justify-between items-center">
            <Text className={`text-lg font-bold ${hasUnread ? "text-gray-900" : "text-gray-700"}`}>
              {room.roomName}
            </Text>
            {timeText ? (
              <Text className={`text-xs ${hasUnread ? "text-gray-600" : "text-gray-400"}`}>
                {timeText}
              </Text>
            ) : null}
          </View>

          <View className="flex-row justify-between items-center mt-1">
            <Text
              className={`flex-1 text-sm mr-2 ${hasUnread ? "text-gray-700" : "text-gray-500"}`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {messagePreview}
            </Text>

            {hasUnread && (
              <View className="bg-blue-500 rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                <Text className="text-white text-xs font-bold">
                  {room.unreadCount > 99 ? "99+" : room.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ==================== MAIN COMPONENT ====================

export default function ChatRoomsList() {
  const navigation = useNavigation();
  const { isConnected, isInitialized, user, lastMessages, unreadCounts, initialize, refreshRoomData, markRoomAsRead } = useSocket();

  // Local state
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs to prevent duplicate loads
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);

  // ==================== DATA LOADING ====================

  const loadRooms = useCallback(async (forceRefresh = false) => {
    if (!isMountedRef.current) return;

    try {
      // Load from cache first (only on initial load)
      if (!forceRefresh && !hasLoadedRef.current) {
        const cached = await ChatRoomStorage.getChatRooms();
        if (cached?.rooms?.length) {
          console.log("📦 [Rooms] Loaded from cache:", cached.rooms.length);
          setRooms(cached.rooms.map((r) => ({
            ...r,
            unreadCount: 0,
            onlineCount: 0,
          })));
          setIsLoading(false);
        }
      }

      // Fetch from server
      console.log("🔄 [Rooms] Fetching from server...");
      setIsSyncing(true);

      const freshRooms = await fetchChatRooms();
      hasLoadedRef.current = true;

      if (!isMountedRef.current) return;

      // Save to cache
      await ChatRoomStorage.saveChatRooms(freshRooms);

      // Update state
      setRooms(freshRooms.map((r) => ({
        ...r,
        unreadCount: 0,
        onlineCount: 0,
      })));

      console.log("✅ [Rooms] Loaded:", freshRooms.length);
    } catch (error) {
      console.error("❌ [Rooms] Load error:", error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsSyncing(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // ==================== SOCKET DATA APPLICATION ====================

  // Apply socket data to rooms
  const roomsWithSocketData = React.useMemo(() => {
    return rooms.map((room) => {
      const roomId = room.roomId?.toString() || "";
      return {
        ...room,
        lastMessage: lastMessages[roomId] || room.lastMessage,
        unreadCount: unreadCounts[roomId] ?? room.unreadCount,
      };
    });
  }, [rooms, lastMessages, unreadCounts]);

  // Sort by recent activity
  const sortedRooms = React.useMemo(() => {
    return [...roomsWithSocketData].sort((a, b) => {
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
  }, [roomsWithSocketData]);

  // Filter by search
  const filteredRooms = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedRooms;
    const query = searchQuery.toLowerCase();
    return sortedRooms.filter((r) =>
      r.roomName?.toLowerCase().includes(query)
    );
  }, [sortedRooms, searchQuery]);

  // ==================== SOCKET SUBSCRIPTIONS ====================

  // Subscribe to room updates
  useRoomListSubscription({
    onRoomUpdate: useCallback((data: RoomUpdate) => {
      console.log("🏠 [Rooms] Update:", data.roomId);
      setRooms((prev) =>
        prev.map((r) =>
          r.roomId?.toString() === data.roomId
            ? {
                ...r,
                lastMessage: data.lastMessage || r.lastMessage,
                unreadCount: data.unreadCount ?? r.unreadCount,
              }
            : r
        )
      );
    }, []),
    onOnlineUsers: useCallback((data: OnlineUsersUpdate) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.roomId?.toString() === data.roomId
            ? { ...r, onlineCount: data.count }
            : r
        )
      );
    }, []),
    onNewMessage: useCallback((message: ChatMessage) => {
      console.log("📨 [Rooms] New message in room:", message.roomId);
      setRooms((prev) =>
        prev.map((r) => {
          if (r.roomId?.toString() === message.roomId.toString()) {
            const newLastMessage: LastMessage = {
              id: typeof message.id === 'number' ? message.id : parseInt(message.id as string) || 0,
              messageText: message.messageText,
              messageType: message.messageType,
              createdAt: message.createdAt,
              roomId: message.roomId.toString(),
              sender: {
                userId: message.senderId,
                userName: message.senderName,
              },
              mediaFilesId: message.mediaFilesId,
              pollId: message.pollId,
              tableId: message.tableId,
            };
            return {
              ...r,
              lastMessage: newLastMessage,
              // Increment unread count if message is from another user
              unreadCount: message.senderId !== user?.id ? (r.unreadCount || 0) + 1 : r.unreadCount,
            };
          }
          return r;
        })
      );
    }, [user?.id]),
    onMessageEdited: useCallback((data: MessageEditedEvent) => {
      console.log("✏️ [Rooms] Message edited in room:", data.roomId);
      setRooms((prev) =>
        prev.map((r) => {
          if (r.roomId?.toString() === data.roomId && r.lastMessage?.id === data.messageId) {
            return {
              ...r,
              lastMessage: {
                ...r.lastMessage,
                messageText: data.messageText,
              },
            };
          }
          return r;
        })
      );
    }, []),
    onMessagesDeleted: useCallback((data: MessagesDeletedEvent) => {
      console.log("🗑️ [Rooms] Messages deleted in room:", data.roomId, data.messageIds);
      setRooms((prev) =>
        prev.map((r) => {
          if (r.roomId?.toString() === data.roomId) {
            // Check if the last message was deleted
            const lastMsgId = r.lastMessage?.id;
            const wasLastMessageDeleted = lastMsgId && data.messageIds.includes(lastMsgId);
            
            if (wasLastMessageDeleted) {
              // Clear the last message - it will be refreshed on next sync
              return {
                ...r,
                lastMessage: undefined,
                // Decrement unread count if deleted messages were unread
                unreadCount: Math.max(0, (r.unreadCount || 0) - data.messageIds.length),
              };
            }
            
            // Just decrement unread count for other deleted messages
            return {
              ...r,
              unreadCount: Math.max(0, (r.unreadCount || 0) - data.messageIds.length),
            };
          }
          return r;
        })
      );
      // Trigger a refresh to get the new last message
      refreshRoomData();
    }, [refreshRoomData]),
  });

  // ==================== EFFECTS ====================

  // Initialize socket on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load rooms on focus
  useFocusEffect(
    useCallback(() => {
      console.log("📱 [Rooms] Screen focused");

      // Load rooms if not loaded
      if (!hasLoadedRef.current) {
        loadRooms();
      }

      // Refresh socket data
      if (isConnected) {
        refreshRoomData();
      }

      // Notification handler
      const handleNotification = (data: { roomId: string }) => {
        router.push(`/chat/${data.roomId}`);
      };
      eventEmitter.on("openChatRoom", handleNotification);

      return () => {
        eventEmitter.off("openChatRoom", handleNotification);
      };
    }, [isConnected])
  );

  // ==================== HANDLERS ====================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadRooms(true);
    if (isConnected) {
      refreshRoomData();
    }
  }, [loadRooms, isConnected, refreshRoomData]);

  const handleRoomPress = useCallback((roomId: string) => {
    markRoomAsRead(roomId);
    setRooms((prev) =>
      prev.map((r) =>
        r.roomId?.toString() === roomId ? { ...r, unreadCount: 0 } : r
      )
    );
    router.push({ pathname: "/chat/[roomId]", params: { roomId } });
  }, [markRoomAsRead]);

  // ==================== RENDER ====================

  if (isLoading && !rooms.length) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-gray-500 mt-3">Loading chats...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient
        colors={["#3b82f6", "#3b82f6", "#3b82f6"]}
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
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          className="p-1"
        >
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>

        <View className="flex-1 items-center flex-row justify-center">
          <Text className="text-[22px] font-bold text-white tracking-wide">
            Sevak App
          </Text>
          {isSyncing && (
            <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />
          )}
        </View>

        <View className="w-[38px]" />
      </LinearGradient>

      {/* Search */}
      <View className="p-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3">
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            placeholder="Search chat rooms..."
            className="flex-1 ml-3 text-gray-800"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Connection status */}
      {!isConnected && (
        <View className="bg-yellow-100 px-4 py-2 flex-row items-center">
          <Ionicons name="warning-outline" size={16} color="#b45309" />
          <Text className="text-yellow-800 text-sm ml-2">Connecting...</Text>
        </View>
      )}

      {/* Room list */}
      <FlatList
        data={filteredRooms}
        keyExtractor={(item) => item.roomId?.toString() || String(Math.random())}
        renderItem={({ item }) => (
          <RoomItem
            room={item}
            currentUserId={user?.id}
            onPress={handleRoomPress}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#3b82f6"]}
          />
        }
        ListEmptyComponent={<NoChatRoomComponenet searchQuery={searchQuery} />}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={15}
      />
    </View>
  );
}
