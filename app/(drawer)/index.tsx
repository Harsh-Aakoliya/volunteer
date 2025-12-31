// app/(drawer)/index.tsx
// Chat Rooms List - Telegram-style implementation

import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Animated,
  Dimensions,
  StatusBar,
  Keyboard,
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
import {
  LastMessage,
  RoomUpdate,
  OnlineUsersUpdate,
  ChatMessage,
  MessageEditedEvent,
  MessagesDeletedEvent,
} from "@/utils/socketManager";
import eventEmitter from "@/utils/eventEmitter";

// ==================== CONSTANTS ====================

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Telegram-style avatar colors (lighter, more pastel)
const AVATAR_COLORS = [
  ["#FF8A80", "#FF5252"], // Red
  ["#69F0AE", "#00E676"], // Green
  ["#82B1FF", "#448AFF"], // Blue
  ["#FFD180", "#FFAB40"], // Orange
  ["#B388FF", "#7C4DFF"], // Purple
  ["#84FFFF", "#18FFFF"], // Cyan
  ["#CCFF90", "#B2FF59"], // Lime
  ["#FF80AB", "#FF4081"], // Pink
  ["#A7FFEB", "#64FFDA"], // Teal
  ["#FFE57F", "#FFD740"], // Amber
  ["#8C9EFF", "#536DFE"], // Indigo
  ["#EA80FC", "#E040FB"], // Purple accent
];

// Get consistent color for a room based on its ID/name
const getAvatarColor = (identifier: string): string[] => {
  return  ["#82B1FF", "#448AFF"]; // Blue
  const hash = identifier.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Get initials from room name
const getInitials = (name: string): string => {
  if (!name) return "?";
  const words = name.trim().split(" ");
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
};

// ==================== TYPES ====================

// UPDATE the RoomListItem interface:
interface RoomListItem extends ChatRoom {
  unreadCount: number;
  lastMessage?: LastMessage;
  onlineCount?: number;  // Optional since groups might have this
}

// ==================== AVATAR COMPONENT ====================

interface AvatarProps {
  name: string;
  isGroup: boolean;
  isEmoji?: boolean;
  size?: number;
  isOnline?: boolean;
}

const Avatar = memo(({ name, isGroup, isEmoji, size = 56, isOnline = false }: AvatarProps) => {
  const colors = getAvatarColor(name);
  const initials = getInitials(name);
  
  // Show group icon if isGroup is true OR isEmoji is true
  const showGroupIcon = isGroup || isEmoji;

  return (
    <View style={{ position: "relative" }}>
      <LinearGradient
        colors={colors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {showGroupIcon ? (
          <Ionicons name="people" size={size * 0.45} color="#fff" />
        ) : (
          <Text
            style={{
              color: "#fff",
              fontSize: size * 0.38,
              fontWeight: "600",
              letterSpacing: 0.5,
            }}
          >
            {initials}
          </Text>
        )}
      </LinearGradient>

      {/* Online indicator */}
      {isOnline && !showGroupIcon && (
        <View
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: "#4CAF50",
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      )}
    </View>
  );
});

// ==================== ROOM ITEM COMPONENT ====================

interface RoomItemProps {
  room: RoomListItem;
  currentUserId: string | undefined;
  onPress: (roomId: string) => void;
  onLongPress?: (room: RoomListItem) => void;
}

const RoomItem = memo(({ room, currentUserId, onPress, onLongPress }: RoomItemProps) => {
  const hasUnread = room.unreadCount > 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Format message preview
  let messagePreview = "No messages yet";
  let previewPrefix = "";
  let isMediaMessage = false;

  if (room.lastMessage) {
    const isOwn = room.lastMessage.sender.userId === currentUserId;
    previewPrefix = isOwn ? "You: " : "";

    if (room.lastMessage.messageText) {
      messagePreview = room.lastMessage.messageText;
    } else if (room.lastMessage.pollId) {
      messagePreview = "📊 Poll";
      isMediaMessage = true;
    } else if (room.lastMessage.tableId) {
      messagePreview = "📋 Table";
      isMediaMessage = true;
    } else if (room.lastMessage.mediaFilesId) {
      messagePreview = "📷 Photo";
      isMediaMessage = true;
    } else {
      messagePreview = "Message";
    }
  } else if (room.roomDescription) {
    messagePreview = room.roomDescription;
  }

  // Format time - Telegram style
  let timeText = "";
  if (room.lastMessage?.createdAt) {
    try {
      const date = new Date(room.lastMessage.createdAt);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        timeText = date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } else if (diffDays === 1) {
        timeText = "Yesterday";
      } else if (diffDays < 7) {
        timeText = date.toLocaleDateString("en-US", { weekday: "short" });
      } else {
        timeText = date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        });
      }
    } catch {}
  }

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={{
          paddingVertical: 10,
          paddingHorizontal: 16,
          backgroundColor: hasUnread ? "#E3F2FD" : "#FFFFFF",
        }}
        activeOpacity={0.7}
        onPress={() => room.roomId && onPress(room.roomId.toString())}
        onLongPress={() => onLongPress?.(room)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Avatar */}
          <Avatar
            name={room.roomName || "Chat"}
            isGroup={room.isGroup || false}
            isEmoji={true}
            size={56}
          />

          {/* Content */}
          <View style={{ flex: 1, marginLeft: 14 }}>
            {/* Top Row: Name + Time */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: hasUnread ? "700" : "600",
                    color: "#1C1C1E",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {room.roomName}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: hasUnread ? "#2196F3" : "#8E8E93",
                    fontWeight: hasUnread ? "600" : "400",
                  }}
                >
                  {timeText}
                </Text>
              </View>
            </View>

            {/* Bottom Row: Message Preview + Badge */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: hasUnread ? "#1C1C1E" : "#8E8E93",
                  fontWeight: hasUnread ? "500" : "400",
                  marginRight: 8,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {room.isGroup && room.lastMessage && !isMediaMessage && (
                  <Text style={{ color: "#2196F3", fontWeight: "600" }}>
                    {room.lastMessage.sender.userName?.split(" ")[0]}:{" "}
                  </Text>
                )}
                {previewPrefix && (
                  <Text style={{ color: "#2196F3", fontWeight: "500" }}>
                    {previewPrefix}
                  </Text>
                )}
                <Text style={{ color: isMediaMessage ? "#2196F3" : undefined }}>
                  {messagePreview}
                </Text>
              </Text>

              {/* Unread Badge */}
              {hasUnread && (
                <View
                  style={{
                    backgroundColor: "#2196F3",
                    borderRadius: 12,
                    minWidth: 24,
                    height: 24,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 7,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    {room.unreadCount > 999 ? "999+" : room.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Separator */}
      <View
        style={{
          height: 0.5,
          backgroundColor: "#E5E5EA",
          marginLeft: 86,
        }}
      />
    </Animated.View>
  );
});

// ==================== HEADER COMPONENT ====================

interface HeaderProps {
  isSearchMode: boolean;
  searchQuery: string;
  isSyncing: boolean;
  onSearchPress: () => void;
  onBackPress: () => void;
  onSearchChange: (text: string) => void;
  onMenuPress: () => void;
}

const Header = memo(
  ({
    isSearchMode,
    searchQuery,
    isSyncing,
    onSearchPress,
    onBackPress,
    onSearchChange,
    onMenuPress,
  }: HeaderProps) => {
    const searchInputRef = useRef<TextInput>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-20)).current;

    useEffect(() => {
      if (isSearchMode) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          searchInputRef.current?.focus();
        });
      } else {
        fadeAnim.setValue(0);
        slideAnim.setValue(-20);
        Keyboard.dismiss();
      }
    }, [isSearchMode]);

    if (isSearchMode) {
      return (
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 56,
            paddingHorizontal: 8,
            backgroundColor: "#FFFFFF",
            borderBottomWidth: 1,
            borderBottomColor: "#E5E5EA",
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          }}
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={onBackPress}
            style={{
              padding: 8,
              marginRight: 4,
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#2196F3" />
          </TouchableOpacity>

          {/* Search Input */}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#F5F5F5",
              borderRadius: 10,
              paddingHorizontal: 12,
              height: 40,
            }}
          >
            <Ionicons name="search" size={18} color="#8E8E93" />
            <TextInput
              ref={searchInputRef}
              placeholder="Search chats..."
              placeholderTextColor="#8E8E93"
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 16,
                color: "#1C1C1E",
              }}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange("")}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      );
    }

    return (
      <LinearGradient
        colors={["#42A5F5", "#1E88E5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          paddingHorizontal: 16,
          elevation: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }}
      >
        {/* Menu Button */}
        <TouchableOpacity onPress={onMenuPress} style={{ padding: 4 }}>
          <Ionicons name="menu" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Title */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#FFFFFF",
              letterSpacing: 0.5,
            }}
          >
            Sevak App
          </Text>
          {isSyncing && (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
              style={{ marginLeft: 8 }}
            />
          )}
        </View>

        {/* Search Button */}
        <TouchableOpacity onPress={onSearchPress} style={{ padding: 4 }}>
          <Ionicons name="search" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>
    );
  }
);

// ==================== EMPTY STATE COMPONENT ====================

const EmptySearchResults = memo(({ searchQuery }: { searchQuery: string }) => (
  <View
    style={{
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    }}
  >
    <Ionicons name="search-outline" size={64} color="#C5CAE9" />
    <Text
      style={{
        fontSize: 18,
        fontWeight: "600",
        color: "#5C6BC0",
        marginTop: 16,
        textAlign: "center",
      }}
    >
      No results found
    </Text>
    <Text
      style={{
        fontSize: 14,
        color: "#9FA8DA",
        marginTop: 8,
        textAlign: "center",
      }}
    >
      No chats matching "{searchQuery}"
    </Text>
  </View>
));

// ==================== MAIN COMPONENT ====================

export default function ChatRoomsList() {
  const navigation = useNavigation();
  const {
    isConnected,
    isInitialized,
    user,
    lastMessages,
    unreadCounts,
    initialize,
    refreshRoomData,
    markRoomAsRead,
  } = useSocket();

  // Local state
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  const listRef = useRef<FlatList>(null);

  // ==================== DATA LOADING ====================

// REPLACE the loadRooms function:
const loadRooms = useCallback(async (forceRefresh = false) => {
  if (!isMountedRef.current) return;

  try {
    if (!forceRefresh && !hasLoadedRef.current) {
      const cached = await ChatRoomStorage.getChatRooms();
      if (cached?.rooms?.length) {
        console.log("📦 [Rooms] Loaded from cache:", cached.rooms.length);
        setRooms(
          cached.rooms.map((r: any) => ({
            ...r,
            unreadCount: r.unreadCount || 0,
            lastMessage: r.lastMessage || undefined,
          }))
        );
        setIsLoading(false);
      }
    }

    console.log("🔄 [Rooms] Fetching from server...");
    setIsSyncing(true);

    const freshRooms = await fetchChatRooms();
    hasLoadedRef.current = true;

    if (!isMountedRef.current) return;

    // Save to cache with lastMessage and unreadCount
    await ChatRoomStorage.saveChatRooms(freshRooms);

    setRooms(
      freshRooms.map((r: any) => ({
        ...r,
        unreadCount: r.unreadCount || 0,
        lastMessage: r.lastMessage || undefined,
      }))
    );

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

const roomsWithSocketData = React.useMemo(() => {
  return rooms.map((room) => {
    const roomId = room.roomId?.toString() || "";
    
    // Socket data takes priority over initial/cached data
    const socketLastMessage = lastMessages[roomId];
    const socketUnreadCount = unreadCounts[roomId];
    
    return {
      ...room,
      lastMessage: socketLastMessage || room.lastMessage,
      unreadCount: socketUnreadCount !== undefined ? socketUnreadCount : room.unreadCount,
    };
  });
}, [rooms, lastMessages, unreadCounts]);

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

  const filteredRooms = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedRooms;
    const query = searchQuery.toLowerCase();
    return sortedRooms.filter((r) => r.roomName?.toLowerCase().includes(query));
  }, [sortedRooms, searchQuery]);

  // ==================== SOCKET SUBSCRIPTIONS ====================

  useRoomListSubscription({
    onRoomUpdate: useCallback((data: RoomUpdate) => {
      console.log("���� [Rooms] Update:", data.roomId);
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
    onNewMessage: useCallback(
      (message: ChatMessage) => {
        console.log("📨 [Rooms] New message in room:", message.roomId);
        setRooms((prev) =>
          prev.map((r) => {
            if (r.roomId?.toString() === message.roomId.toString()) {
              const newLastMessage: LastMessage = {
                id:
                  typeof message.id === "number"
                    ? message.id
                    : parseInt(message.id as string) || 0,
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
                unreadCount:
                  message.senderId !== user?.id
                    ? (r.unreadCount || 0) + 1
                    : r.unreadCount,
              };
            }
            return r;
          })
        );
      },
      [user?.id]
    ),
    onMessageEdited: useCallback((data: MessageEditedEvent & { isLastMessage?: boolean }) => {
      console.log("✏️ [Rooms] Message edited in room:", data.roomId);
      setRooms((prev) =>
        prev.map((r) => {
          if (
            r.roomId?.toString() === data.roomId &&
            r.lastMessage?.id === data.messageId
          ) {
            const updatedRoom = {
              ...r,
              lastMessage: {
                ...r.lastMessage,
                messageText: data.messageText,
              },
            };
            return updatedRoom;
          }
          return r;
        })
      );
      
      // Update local cache
      ChatRoomStorage.getChatRooms().then((cached) => {
        if (cached?.rooms) {
          const updatedRooms = cached.rooms.map((r) => {
            if (
              r.roomId?.toString() === data.roomId &&
              (r as any).lastMessage?.id === data.messageId
            ) {
              return {
                ...r,
                lastMessage: {
                  ...(r as any).lastMessage,
                  messageText: data.messageText,
                },
              };
            }
            return r;
          });
          ChatRoomStorage.saveChatRooms(updatedRooms);
        }
      });
    }, []),
    onMessagesDeleted: useCallback(
      (data: MessagesDeletedEvent & { newLastMessage?: LastMessage; wasLastMessageDeleted?: boolean }) => {
        console.log(
          "🗑️ [Rooms] Messages deleted in room:",
          data.roomId,
          data.messageIds
        );
        
        setRooms((prev) =>
          prev.map((r) => {
            if (r.roomId?.toString() === data.roomId) {
              // Only update lastMessage if it was deleted
              if (data.wasLastMessageDeleted) {
                return {
                  ...r,
                  lastMessage: data.newLastMessage || undefined,
                  // DO NOT modify unreadCount here - it will be refreshed from server
                };
              }
              return r;
            }
            return r;
          })
        );
        
        // Refresh room data from server to get accurate unread counts
        refreshRoomData();
      },
      [refreshRoomData]
    ),
  });

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("📱 [Rooms] Screen focused");

      if (!hasLoadedRef.current) {
        loadRooms();
      }

      if (isConnected) {
        refreshRoomData();
      }

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

  const handleRoomPress = useCallback(
    (roomId: string) => {
      // Close search if open
      if (isSearchMode) {
        setIsSearchMode(false);
        setSearchQuery("");
      }
      
      markRoomAsRead(roomId);
      setRooms((prev) =>
        prev.map((r) =>
          r.roomId?.toString() === roomId ? { ...r, unreadCount: 0 } : r
        )
      );
      router.push({ pathname: "/chat/[roomId]", params: { roomId } });
    },
    [markRoomAsRead, isSearchMode]
  );

  const handleSearchPress = useCallback(() => {
    setIsSearchMode(true);
  }, []);

  const handleBackPress = useCallback(() => {
    setIsSearchMode(false);
    setSearchQuery("");
    Keyboard.dismiss();
  }, []);

  const handleMenuPress = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  // ==================== RENDER ====================

  if (isLoading && !rooms.length) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ color: "#8E8E93", marginTop: 16, fontSize: 16 }}>
          Loading chats...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar
        barStyle={isSearchMode ? "dark-content" : "light-content"}
        backgroundColor={isSearchMode ? "#FFFFFF" : "#42A5F5"}
      />

      {/* Header */}
      <Header
        isSearchMode={isSearchMode}
        searchQuery={searchQuery}
        isSyncing={isSyncing}
        onSearchPress={handleSearchPress}
        onBackPress={handleBackPress}
        onSearchChange={setSearchQuery}
        onMenuPress={handleMenuPress}
      />

      {/* Room List */}
      <FlatList
        ref={listRef}
        data={filteredRooms}
        keyExtractor={(item) =>
          item.roomId?.toString() || String(Math.random())
        }
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
            colors={["#2196F3"]}
            tintColor="#2196F3"
          />
        }
        ListEmptyComponent={
          searchQuery.trim() ? (
            <EmptySearchResults searchQuery={searchQuery} />
          ) : (
            <NoChatRoomComponenet searchQuery={searchQuery} />
          )
        }
        contentContainerStyle={
          filteredRooms.length === 0 ? { flex: 1 } : undefined
        }
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={20}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}