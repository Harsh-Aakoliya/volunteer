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
  BackHandler,
  ToastAndroid
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { ChatRoomStorage } from "@/utils/chatRoomsStorage";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { DrawerActions } from "@react-navigation/native";
import NoChatRoomComponenet from "@/components/chat/NoChatRoomComponenet";
import { useSocket } from "@/contexts/SocketContext";
import eventEmitter from "@/utils/eventEmitter";

// ==================== CONSTANTS ====================
// Telegram-style avatar colors (lighter, more pastel)
const AVATAR_COLORS = [
  ["#D32F2F", "#B71C1C"], // Red (strong)
  ["#2E7D32", "#1B5E20"], // Green (deep)
  ["#1565C0", "#0D47A1"], // Blue
  ["#EF6C00", "#E65100"], // Orange (burnt)
  ["#6A1B9A", "#4A148C"], // Purple
  ["#C2185B", "#880E4F"], // Pink
  ["#00695C", "#004D40"], // Teal
  ["#FF8F00", "#FF6F00"], // Amber (darkened)
  ["#283593", "#1A237E"], // Indigo
  ["#8E24AA", "#6A1B9A"], // Purple accent
];


// Get consistent color for a room based on its ID/name
const getAvatarColor = (identifier: string): string[] => {
  // return  ["#82B1FF", "#448AFF"]; // Blue
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

// Strip HTML tags from text for preview display
const stripHtmlTags = (html: string): string => {
  if (!html) return "";
  let text = html;

  // Replace block elements with newlines for better readability
  text = text.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Clean up multiple spaces and newlines
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single space
  text = text.replace(/\n\s*\n/g, '\n'); // Multiple newlines to single newline
  text = text.replace(/^\s+|\s+$/g, ''); // Trim start and end

  return text;
};

// ==================== TYPES ====================

// Simplified RoomListItem using unified RoomData
interface RoomListItem {
  roomId: string;
  roomName: string;
  isAdmin: boolean;
  canSendMessage: boolean;
  lastMessage: {
    id: number;
    text: string;
    messageType: string;
    senderName: string;
    senderId: string;
    timestamp: string;
    replyMessageId?: number;
    replyMessageType?: string;
    replyMessageText?: string;
    replySenderName?: string;
  } | null;
  unreadCount: number;
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
import RenderHtml from 'react-native-render-html';

const RoomItem = memo(({ room, currentUserId, onPress, onLongPress }: RoomItemProps) => {
  const hasUnread = room.unreadCount > 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Helper function to format reply preview for last message
  const getReplyPreviewTextForLastMessage = (reply: { messageType: string; messageText: string }): string => {
    switch (reply.messageType) {
      case 'media':
        if (reply.messageText && reply.messageText.trim() !== '') {
          return stripHtmlTags(reply.messageText);
        }
        return '📷 Media';
      case 'poll':
        return '📊 Poll';
      case 'table':
        return '📋 Table';
      case 'announcement':
        return '📢 Announcement';
      case 'text':
      default:
        return reply.messageText ? stripHtmlTags(reply.messageText) : 'Message';
    }
  };

  // Format message preview using unified lastMessage structure
  let messagePreview = "No messages yet";
  let previewPrefix = "";
  let isMediaMessage = false;

  if (room.lastMessage) {
    const isOwn = room.lastMessage.senderId === currentUserId;
    previewPrefix = isOwn ? "You: " : "";

    // Handle reply messages - show reply preview if exists
    if (room.lastMessage.replyMessageId && room.lastMessage.replyMessageType) {
      const replyPreview = getReplyPreviewTextForLastMessage({
        messageType: room.lastMessage.replyMessageType,
        messageText: room.lastMessage.replyMessageText || '',
      });
      messagePreview = `↩️ ${replyPreview}`;
    } else {
      // Strip HTML tags from message text for clean preview
      messagePreview = stripHtmlTags(room.lastMessage.text);
    }

    isMediaMessage = room.lastMessage.messageType !== 'text';
  }

  // Format time - Telegram style
  let timeText = "";
  if (room.lastMessage?.timestamp) {
    try {
      const date = new Date(room.lastMessage.timestamp);
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
    } catch { }
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
        onPress={() => room.roomId && onPress(room.roomId)}
        onLongPress={() => onLongPress?.(room)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Avatar */}
          <Avatar
            name={room.roomName || "Chat"}
            isGroup={true}
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
                {room.lastMessage && !previewPrefix && (
                  <Text style={{ color: "#2196F3", fontWeight: "600" }}>
                    {room.lastMessage.senderName?.split(" ")[0]}:{" "}
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
          {/* {isSyncing && (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
              style={{ marginLeft: 8 }}
            />
          )} */}
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
    rooms: socketRooms,
    initialize,
    refreshRoomData,
    markRoomAsRead,
  } = useSocket();

  // Local state - rooms from cache, updated by socket
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

  // Load rooms from cache only - socket will update with fresh data
  const loadFromCache = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      const cached = await ChatRoomStorage.getChatRooms();
      if (cached?.rooms?.length) {
        console.log("📦 [Rooms] Loaded from cache:", cached.rooms.length);
        // Convert cached data to RoomListItem format
        const cachedRooms: RoomListItem[] = cached.rooms.map((r: any) => ({
          roomId: r.roomId?.toString() || '',
          roomName: r.roomName || 'Chat',
          isAdmin: Boolean(r.isAdmin),
          canSendMessage: Boolean(r.canSendMessage),
          lastMessage: r.lastMessage ? {
            id: r.lastMessage.id,
            text: r.lastMessage.messageText || r.lastMessage.text || '',
            messageType: r.lastMessage.messageType || 'text',
            senderName: r.lastMessage.sender?.userName || r.lastMessage.senderName || 'Unknown',
            senderId: r.lastMessage.sender?.userId || r.lastMessage.senderId || '',
            timestamp: r.lastMessage.createdAt || r.lastMessage.timestamp || '',
            replyMessageId: r.lastMessage.replyMessageId,
            replyMessageType: r.lastMessage.replyMessageType,
            replyMessageText: r.lastMessage.replyMessageText,
            replySenderName: r.lastMessage.replySenderName,
          } : null,
          unreadCount: r.unreadCount || 0,
        }));
        setRooms(cachedRooms);
        setIsLoading(false);
        setIsSyncing(false);
        setIsRefreshing(false);
        hasLoadedRef.current = true;
        console.log("✅ [Rooms] Cache loaded, loading cleared");
      } else {
        // No cached data - check if we have socket rooms
        console.log("⚠️ [Rooms] No cached data");
        if (socketRooms.length > 0) {
          setIsLoading(false);
          setIsSyncing(false);
          setIsRefreshing(false);
        }
      }
    } catch (error) {
      console.error("❌ [Rooms] Cache load error:", error);
      // On error, still clear loading if we have socket rooms
      if (socketRooms.length > 0) {
        setIsLoading(false);
        setIsSyncing(false);
        setIsRefreshing(false);
      }
    }
  }, [socketRooms.length]);

  // ==================== SOCKET DATA APPLICATION ====================

  // Update rooms when socket data arrives - sync state from context
  useEffect(() => {
    // Always sync rooms from context to local state
    // This ensures real-time updates (roomUpdate, newMessage, etc.) are reflected
    if (socketRooms.length > 0) {
      console.log("🔄 [Rooms] Syncing from context:", socketRooms.length);
      setRooms(socketRooms);
      setIsLoading(false);
      setIsSyncing(false);
      setIsRefreshing(false);
      hasLoadedRef.current = true;
      console.log("✅ [Rooms] Socket data received, loading cleared");
    } else if (hasLoadedRef.current && rooms.length > 0) {
      // Socket rooms is empty but we have cached rooms
      // Keep showing cached data and ensure loading is cleared
      console.log("🔄 [Rooms] Socket empty but have cached rooms, keeping cached data");
      setIsLoading(false);
      setIsSyncing(false);
      setIsRefreshing(false);
    } else if (hasLoadedRef.current && rooms.length === 0 && socketRooms.length === 0) {
      // We've loaded before but have no data at all - this shouldn't happen but clear loading anyway
      console.log("⚠️ [Rooms] No data available, clearing loading state");
      setIsLoading(false);
      setIsSyncing(false);
      setIsRefreshing(false);
    }
  }, [socketRooms, rooms.length]);

  // Sort rooms by last message timestamp
  const sortedRooms = React.useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aTime = a.lastMessage?.timestamp
        ? new Date(a.lastMessage.timestamp).getTime()
        : 0;
      const bTime = b.lastMessage?.timestamp
        ? new Date(b.lastMessage.timestamp).getTime()
        : 0;
      return bTime - aTime;
    });
  }, [rooms]);

  // Filter rooms by search query
  const filteredRooms = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedRooms;
    const query = searchQuery.toLowerCase();
    return sortedRooms.filter((r) => r.roomName?.toLowerCase().includes(query));
  }, [sortedRooms, searchQuery]);

  // Socket subscriptions are now handled in SocketContext
  // Real-time updates flow: socket -> context -> rooms state via useEffect

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // If search mode is open, close it first
        if (isSearchMode) {
          setIsSearchMode(false);
          setSearchQuery('');
          Keyboard.dismiss();
          return true; // Prevent default back behavior
        }

        // Exit the app when back is pressed on main screen
        BackHandler.exitApp();
        return true;
      }
    );

    return () => backHandler.remove();
  }, [isSearchMode]);


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

      // Load from cache first for immediate display
      if (!hasLoadedRef.current) {
        loadFromCache();
      }

      // Request fresh data via socket
      setIsSyncing(true);

      // Always request fresh data when screen is focused, even if socket is not connected yet
      // The socket will send data when it connects
      if (isConnected && isInitialized) {
        refreshRoomData();
      } else if (!isInitialized) {
        // Initialize socket if not already initialized
        initialize().then(() => {
          // After initialization, request room data
          refreshRoomData();
        });
      }

      // Fallback: Clear loading state after a timeout if we have rooms (cached or socket)
      // This ensures loading doesn't stay forever
      const timeoutId = setTimeout(() => {
        if (rooms.length > 0 || socketRooms.length > 0) {
          console.log("⏰ [Rooms] Timeout: Clearing loading state");
          setIsLoading(false);
          setIsSyncing(false);
          setIsRefreshing(false);
        }
      }, 5000); // 5 second timeout

      const handleNotification = (data: { roomId: string }) => {
        router.push(`/chat/${data.roomId}`);
      };
      eventEmitter.on("openChatRoom", handleNotification);

      return () => {
        clearTimeout(timeoutId);
        eventEmitter.off("openChatRoom", handleNotification);
      };
    }, [isConnected, isInitialized, loadFromCache, refreshRoomData, initialize, rooms.length, socketRooms.length])
  );

  // ==================== HANDLERS ====================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setIsSyncing(true);
    refreshRoomData();

    // Fallback: Clear refreshing state after timeout
    setTimeout(() => {
      setIsRefreshing(false);
      setIsSyncing(false);
    }, 5000); // 5 second timeout for refresh
  }, [refreshRoomData]);

  const handleRoomPress = useCallback(
    (roomId: string, roomName?: string, canSendMessage?: boolean) => {
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
      router.push({
        pathname: "/chat/[roomId]",
        params: {
          roomId,
          roomName: roomName || undefined,
          canSendMessage: canSendMessage !== undefined ? String(canSendMessage) : undefined,
        }
      });
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
        keyExtractor={(item) => item.roomId || String(Math.random())}
        renderItem={({ item }) => (
          <RoomItem
            room={item}
            currentUserId={user?.id}
            onPress={(roomId) => handleRoomPress(roomId, item.roomName, Boolean(item.canSendMessage))}
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