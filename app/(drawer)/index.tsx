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
  Platform,
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
import { useApiStore } from "@/stores/apiStore";
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

// Shape of the "lastMessage" field used for both rooms and the aggregated
// community preview (rendered on the main list).
interface ListLastMessage {
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
}

// Simplified RoomListItem using unified RoomData
interface RoomListItem {
  roomId: string;
  roomName: string;
  isAdmin: boolean;
  canSendMessage: boolean;
  lastMessage: ListLastMessage | null;
  unreadCount: number;
  // "-1" (or undefined) means the room is standalone and shown directly
  // on the main list. Otherwise the room is rolled up into a community bucket.
  communityId?: string;
}

// Aggregated representation of a community on the main list.
// Unread count = sum of unread across its rooms.
// Last message = most recent lastMessage among its rooms.
interface CommunityListItem {
  communityId: string;
  communityName: string;
  lastMessage: ListLastMessage | null;
  unreadCount: number;
  roomCount: number;
}

// Discriminated union rendered by the FlatList on the main page.
type MainListItem =
  | { kind: "room"; data: RoomListItem }
  | { kind: "community"; data: CommunityListItem };

// ==================== AVATAR COMPONENT ====================

interface AvatarProps {
  name: string;
  isGroup: boolean;
  isEmoji?: boolean;
  size?: number;
  isOnline?: boolean;
  // When true the avatar is drawn as a rounded square (community badge)
  // instead of a circle, and uses a "grid" glyph instead of the people icon.
  isCommunity?: boolean;
}

const Avatar = memo(({ name, isGroup, isEmoji, size = 56, isOnline = false, isCommunity = false }: AvatarProps) => {
  const colors = getAvatarColor(name);
  const initials = getInitials(name);

  // Show group icon if isGroup is true OR isEmoji is true
  const showGroupIcon = isGroup || isEmoji || isCommunity;

  // Communities get a rounded-square tile; everything else stays circular.
  const borderRadius = isCommunity ? Math.round(size * 0.22) : size / 2;

  return (
    <View style={{ position: "relative" }}>
      <LinearGradient
        colors={colors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {showGroupIcon ? (
          <Ionicons
            name={isCommunity ? "grid" : "people"}
            size={size * 0.45}
            color="#fff"
          />
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

// ==================== SHARED ROW RENDERING ====================

import RenderHtml from 'react-native-render-html';

// Helper function to format reply preview for last message (shared)
const getReplyPreviewTextForLastMessage = (reply: { messageType: string; messageText: string }): string => {
  switch (reply.messageType) {
    case 'media':
      return reply.messageText && reply.messageText.trim() !== ''
        ? stripHtmlTags(reply.messageText)
        : '📷 Media';
    case 'poll':
      return reply.messageText && reply.messageText.trim() !== ''
        ? stripHtmlTags(reply.messageText)
        : '📊 Poll';
    case 'table':
      return '📋 Table';
    case 'announcement':
      return '📢 Announcement';
    case 'text':
    default:
      return reply.messageText ? stripHtmlTags(reply.messageText) : 'Message';
  }
};

// Format a single lastMessage into {preview, prefix} used by the row UI.
const formatLastMessagePreview = (
  lastMessage: ListLastMessage | null,
  currentUserId: string | undefined,
  isCommunity: boolean
): { messagePreview: string; previewPrefix: string; senderFirstName: string | null } => {
  if (!lastMessage) {
    return { messagePreview: "No messages yet", previewPrefix: "", senderFirstName: null };
  }
  const isOwn = lastMessage.senderId === currentUserId;
  // For community rollups we don't show "You: " (the message may belong to any
  // room within the community), we just show "SenderName: ...".
  const previewPrefix = !isCommunity && isOwn ? "You: " : "";

  let messagePreview: string;
  if (lastMessage.replyMessageId && lastMessage.replyMessageType) {
    const replyPreview = getReplyPreviewTextForLastMessage({
      messageType: lastMessage.replyMessageType,
      messageText: lastMessage.replyMessageText || '',
    });
    messagePreview = `↩️ ${replyPreview}`;
  } else {
    messagePreview = stripHtmlTags(lastMessage.text);
  }

  const senderFirstName = previewPrefix
    ? null
    : lastMessage.senderName?.split(" ")[0] || null;

  return { messagePreview, previewPrefix, senderFirstName };
};

// Format timestamp in Telegram-style (today -> time, yesterday, weekday, or date).
const formatRowTimestamp = (timestamp: string | undefined | null): string => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
};

interface ListRowProps {
  name: string;
  lastMessage: ListLastMessage | null;
  unreadCount: number;
  isCommunity: boolean;
  currentUserId: string | undefined;
  onPress: () => void;
  onLongPress?: () => void;
}

// Generic row used for both rooms and communities on the main list.
const ListRow = memo(({
  name,
  lastMessage,
  unreadCount,
  isCommunity,
  currentUserId,
  onPress,
  onLongPress,
}: ListRowProps) => {
  const hasUnread = unreadCount > 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timeColor = hasUnread ? "#2196F3" : "#8E8E93";
  const previewColor = "#8E8E93";

  const { messagePreview, previewPrefix, senderFirstName } =
    formatLastMessagePreview(lastMessage, currentUserId, isCommunity);
  const timeText = formatRowTimestamp(lastMessage?.timestamp);

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
          backgroundColor: hasUnread ? "#E3F2FD" : "#F5F5F5",
        }}
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Avatar (square for community, circle for room) */}
          <Avatar
            name={name || "Chat"}
            isGroup={!isCommunity}
            isEmoji={!isCommunity}
            isCommunity={isCommunity}
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
                  {name}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: timeColor,
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
                  color: previewColor,
                  fontWeight: "400",
                  marginRight: 8,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {lastMessage && senderFirstName && (
                  <Text style={{ fontWeight: "600" }}>
                    {senderFirstName}:{" "}
                  </Text>
                )}
                {previewPrefix && (
                  <Text style={{ fontWeight: "600" }}>
                    {previewPrefix}
                  </Text>
                )}
                <Text>{messagePreview}</Text>
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
                    {unreadCount > 999 ? "999+" : unreadCount}
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
        colors={["#FAFAFA", "#F0F0F0", "#E8E8E8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
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
          <Ionicons name="menu" size={26} color="#000000" />
        </TouchableOpacity>

        {/* Title */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#000000",
              letterSpacing: 0.5,
            }}
          >
            Sevak Application
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
          <Ionicons name="search" size={24} color="#000000" />
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
  const apiUrlReady = useApiStore((s) => s.apiUrlReady);
  const {
    isConnected,
    isInitialized,
    user,
    rooms: socketRooms,
    communities: socketCommunities,
    initialize,
    refreshRoomData,
    markRoomAsRead,
  } = useSocket();

  // Local state - rooms from cache, updated by socket
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [communities, setCommunities] = useState<{ communityId: string; communityName: string }[]>([]);
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
      const [cached, cachedCommunities] = await Promise.all([
        ChatRoomStorage.getChatRooms(),
        ChatRoomStorage.getCommunities(),
      ]);

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
          // -1 means standalone (no community)
          communityId: r.communityId ? String(r.communityId) : "-1",
        }));
        setRooms(cachedRooms);
        if (cachedCommunities?.communities?.length) {
          setCommunities(
            cachedCommunities.communities.map((c) => ({
              communityId: String(c.communityId),
              communityName: c.communityName,
            }))
          );
        }
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
      setRooms(
        socketRooms.map((r) => ({
          roomId: r.roomId,
          roomName: r.roomName,
          isAdmin: r.isAdmin,
          canSendMessage: r.canSendMessage,
          lastMessage: r.lastMessage
            ? {
                id: r.lastMessage.id,
                text: r.lastMessage.text,
                messageType: r.lastMessage.messageType,
                senderName: r.lastMessage.senderName,
                senderId: r.lastMessage.senderId,
                timestamp: r.lastMessage.timestamp,
                replyMessageId: r.lastMessage.replyMessageId,
                replyMessageType: r.lastMessage.replyMessageType,
                replyMessageText: r.lastMessage.replyMessageText,
                replySenderName: r.lastMessage.replySenderName,
              }
            : null,
          unreadCount: r.unreadCount,
          communityId: r.communityId || "-1",
        }))
      );
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

  // Sync communities whenever the socket delivers fresh data.
  useEffect(() => {
    setCommunities(
      socketCommunities.map((c) => ({
        communityId: c.communityId,
        communityName: c.communityName,
      }))
    );
  }, [socketCommunities]);

  // ==================== LIST COMPOSITION ====================

  // Combine rooms + communities into a single display list. Rooms that
  // belong to a known community are rolled up into the community entry
  // (last message = most recent across its rooms, unread = sum). Rooms
  // whose community no longer exists (e.g. community deleted while the
  // chatroom.communityId still points at an old id) fall back to the
  // standalone section so they are never hidden.
  const displayItems = React.useMemo<MainListItem[]>(() => {
    const communityById = new Map(communities.map((c) => [c.communityId, c]));
    const roomsByCommunity = new Map<string, RoomListItem[]>();
    const standaloneRooms: RoomListItem[] = [];

    for (const room of rooms) {
      const cid = room.communityId || "-1";
      if (cid === "-1" || !communityById.has(cid)) {
        standaloneRooms.push(room);
      } else {
        const bucket = roomsByCommunity.get(cid) || [];
        bucket.push(room);
        roomsByCommunity.set(cid, bucket);
      }
    }

    const communityItems: MainListItem[] = [];
    for (const community of communities) {
      const bucket = roomsByCommunity.get(community.communityId) || [];
      if (bucket.length === 0) continue; // no rooms -> skip (nothing to click into)

      // Aggregate: pick the newest lastMessage across the community's rooms
      // and sum unread counts. Unread already honours per-user state because
      // it's sourced from the same room data the main list uses.
      let latest: ListLastMessage | null = null;
      let latestTime = 0;
      let unreadSum = 0;
      for (const room of bucket) {
        unreadSum += room.unreadCount || 0;
        if (room.lastMessage?.timestamp) {
          const t = new Date(room.lastMessage.timestamp).getTime();
          if (!Number.isNaN(t) && t > latestTime) {
            latestTime = t;
            latest = room.lastMessage;
          }
        }
      }

      communityItems.push({
        kind: "community",
        data: {
          communityId: community.communityId,
          communityName: community.communityName,
          lastMessage: latest,
          unreadCount: unreadSum,
          roomCount: bucket.length,
        },
      });
    }

    const roomItems: MainListItem[] = standaloneRooms.map((r) => ({
      kind: "room",
      data: r,
    }));

    const merged = [...communityItems, ...roomItems];

    // Sort by last-message timestamp descending (same rule as before).
    merged.sort((a, b) => {
      const aTime = a.data.lastMessage?.timestamp
        ? new Date(a.data.lastMessage.timestamp).getTime()
        : 0;
      const bTime = b.data.lastMessage?.timestamp
        ? new Date(b.data.lastMessage.timestamp).getTime()
        : 0;
      return bTime - aTime;
    });

    return merged;
  }, [rooms, communities]);

  // Filter the composed list by search query (matches name of room OR community).
  const filteredItems = React.useMemo<MainListItem[]>(() => {
    if (!searchQuery.trim()) return displayItems;
    const query = searchQuery.toLowerCase();
    return displayItems.filter((item) => {
      const name =
        item.kind === "room" ? item.data.roomName : item.data.communityName;
      return name?.toLowerCase().includes(query);
    });
  }, [displayItems, searchQuery]);

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


  // Initialize socket only after API URL is set (avoids connection error on app open)
  useEffect(() => {
    if (apiUrlReady && !isInitialized) {
      initialize();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [apiUrlReady, isInitialized, initialize]);

  useFocusEffect(
    useCallback(() => {
      console.log("📱 [Rooms] Screen focused");

      // Re-apply status bar to match header gradient (fixes mismatch after closing drawer)
      StatusBar.setBarStyle("dark-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#FAFAFA");
      }

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
      } else if (apiUrlReady && !isInitialized) {
        initialize().then(() => refreshRoomData());
      }

      // Fallback: Clear loading state after a timeout even if there are no rooms yet.
      // This prevents the "Loading chats..." spinner from staying forever when the
      // server returns 0 rooms (empty list is still a valid state).
      const timeoutId = setTimeout(() => {
        console.log("⏰ [Rooms] Timeout: Clearing loading state (rooms:", rooms.length, "socketRooms:", socketRooms.length, ")");
        setIsLoading(false);
        setIsSyncing(false);
        setIsRefreshing(false);
      }, 5000); // 5 second timeout

      const handleNotification = (data: { roomId: string }) => {
        router.push(`/chat/${data.roomId}`);
      };
      eventEmitter.on("openChatRoom", handleNotification);

      return () => {
        clearTimeout(timeoutId);
        eventEmitter.off("openChatRoom", handleNotification);
      };
    }, [apiUrlReady, isConnected, isInitialized, loadFromCache, refreshRoomData, initialize, rooms.length, socketRooms.length])
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

  const handleCommunityPress = useCallback(
    (communityId: string, communityName: string) => {
      if (isSearchMode) {
        setIsSearchMode(false);
        setSearchQuery("");
      }
      router.push({
        pathname: "/community/[communityId]",
        params: { communityId, communityName },
      });
    },
    [isSearchMode]
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
    <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FAFAFA"
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

      {/* Room + Community List */}
      <FlatList
        ref={listRef}
        data={filteredItems}
        keyExtractor={(item) =>
          item.kind === "room"
            ? `room-${item.data.roomId || Math.random()}`
            : `community-${item.data.communityId}`
        }
        renderItem={({ item }) => {
          if (item.kind === "community") {
            const c = item.data;
            return (
              <ListRow
                name={c.communityName}
                lastMessage={c.lastMessage}
                unreadCount={c.unreadCount}
                isCommunity
                currentUserId={user?.id}
                onPress={() => handleCommunityPress(c.communityId, c.communityName)}
              />
            );
          }
          const r = item.data;
          return (
            <ListRow
              name={r.roomName}
              lastMessage={r.lastMessage}
              unreadCount={r.unreadCount}
              isCommunity={false}
              currentUserId={user?.id}
              onPress={() =>
                r.roomId && handleRoomPress(r.roomId, r.roomName, Boolean(r.canSendMessage))
              }
            />
          );
        }}
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
          filteredItems.length === 0 ? { flex: 1 } : undefined
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
