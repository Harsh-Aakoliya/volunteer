// app/community/[communityId].tsx
// Community detail screen: lists the chat rooms that belong to one community.
// Reuses the same real-time room data from SocketContext so unread counts
// and last-message previews stay in sync with the main page.

import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSocket } from "@/contexts/SocketContext";

// ==================== AVATAR ====================

const AVATAR_COLORS: [string, string][] = [
  ["#D32F2F", "#B71C1C"],
  ["#2E7D32", "#1B5E20"],
  ["#1565C0", "#0D47A1"],
  ["#EF6C00", "#E65100"],
  ["#6A1B9A", "#4A148C"],
  ["#C2185B", "#880E4F"],
  ["#00695C", "#004D40"],
  ["#FF8F00", "#FF6F00"],
  ["#283593", "#1A237E"],
  ["#8E24AA", "#6A1B9A"],
];

const getAvatarColor = (identifier: string): [string, string] => {
  const hash = identifier.split("").reduce(
    (acc, char) => char.charCodeAt(0) + ((acc << 5) - acc),
    0
  );
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ==================== UTILS ====================

const stripHtmlTags = (html: string): string => {
  if (!html) return "";
  return html
    .replace(/<\/p>|<\/div>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
};

const formatTimestamp = (timestamp: string | undefined | null): string => {
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

// ==================== ROW ====================

interface CommunityRoomItemProps {
  roomId: string;
  roomName: string;
  lastMessage: {
    text: string;
    messageType: string;
    senderName: string;
    senderId: string;
    timestamp: string;
    replyMessageId?: number;
    replyMessageType?: string;
    replyMessageText?: string;
  } | null;
  unreadCount: number;
  canSendMessage: boolean;
  currentUserId: string | undefined;
  onPress: () => void;
}

const CommunityRoomItem = memo((props: CommunityRoomItemProps) => {
  const { roomName, lastMessage, unreadCount, currentUserId, onPress } = props;
  const hasUnread = unreadCount > 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colors = getAvatarColor(roomName);

  const timeColor = hasUnread ? "#2196F3" : "#8E8E93";

  let messagePreview = "No messages yet";
  let previewPrefix = "";
  let senderFirstName: string | null = null;
  if (lastMessage) {
    const isOwn = lastMessage.senderId === currentUserId;
    previewPrefix = isOwn ? "You: " : "";
    if (lastMessage.replyMessageId && lastMessage.replyMessageType) {
      const replyText = lastMessage.replyMessageText
        ? stripHtmlTags(lastMessage.replyMessageText)
        : "Message";
      messagePreview = `↩️ ${replyText}`;
    } else {
      messagePreview = stripHtmlTags(lastMessage.text);
    }
    if (!previewPrefix) {
      senderFirstName = lastMessage.senderName?.split(" ")[0] || null;
    }
  }

  const timeText = formatTimestamp(lastMessage?.timestamp);

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
    

    useEffect(() => {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if(router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(drawer)");
          }
          return true;
        }
      );
  
      return () => backHandler.remove();
    }, []);

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
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Circular group avatar */}
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="people" size={26} color="#fff" />
          </LinearGradient>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
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
                {roomName}
              </Text>
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
                  color: "#8E8E93",
                  marginRight: 8,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {senderFirstName && (
                  <Text style={{ fontWeight: "600" }}>
                    {senderFirstName}:{" "}
                  </Text>
                )}
                {previewPrefix && (
                  <Text style={{ fontWeight: "600" }}>{previewPrefix}</Text>
                )}
                <Text>{messagePreview}</Text>
              </Text>

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

// ==================== SCREEN ====================

export default function CommunityScreen() {
  const params = useLocalSearchParams<{ communityId: string; communityName?: string }>();
  const communityId = String(params.communityId || "");
  const routeCommunityName = typeof params.communityName === "string"
    ? params.communityName
    : undefined;

  const { user, rooms, communities, markRoomAsRead } = useSocket();

  // Resolve community metadata from the live context (falls back to route params
  // to avoid a blank header during the very first render).
  const community = useMemo(() => {
    const found = communities.find((c) => c.communityId === communityId);
    return {
      communityId,
      communityName: found?.communityName || routeCommunityName || "Community",
    };
  }, [communities, communityId, routeCommunityName]);

  // Rooms that belong to this community.
  const communityRooms = useMemo(() => {
    return rooms
      .filter((r) => (r.communityId || "-1") === communityId)
      .slice()
      .sort((a, b) => {
        const aTime = a.lastMessage?.timestamp
          ? new Date(a.lastMessage.timestamp).getTime()
          : 0;
        const bTime = b.lastMessage?.timestamp
          ? new Date(b.lastMessage.timestamp).getTime()
          : 0;
        return bTime - aTime;
      });
  }, [rooms, communityId]);

  const handleRoomPress = useCallback(
    (roomId: string, roomName?: string, canSendMessage?: boolean) => {
      markRoomAsRead(roomId);
      router.push({
        pathname: "/chat/[roomId]",
        params: {
          roomId,
          roomName: roomName || undefined,
          canSendMessage:
            canSendMessage !== undefined ? String(canSendMessage) : undefined,
        },
      });
    },
    [markRoomAsRead]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(drawer)");
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header */}
      <LinearGradient
        colors={["#FAFAFA", "#F0F0F0", "#E8E8E8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 56,
          paddingHorizontal: 8,
          elevation: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          paddingTop: Platform.OS === "android" ? 0 : 0,
        }}
      >
        <TouchableOpacity onPress={handleBack} style={{ padding: 8, marginRight: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          {/* Square community badge */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              overflow: "hidden",
              marginRight: 12,
            }}
          >
            <LinearGradient
              colors={getAvatarColor(community.communityName)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="grid" size={18} color="#fff" />
            </LinearGradient>
          </View>

          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#000000",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {community.communityName}
          </Text>
        </View>
      </LinearGradient>

      <FlatList
        data={communityRooms}
        keyExtractor={(item) => `community-${communityId}-room-${item.roomId}`}
        renderItem={({ item }) => (
          <CommunityRoomItem
            roomId={item.roomId}
            roomName={item.roomName}
            lastMessage={item.lastMessage as any}
            unreadCount={item.unreadCount || 0}
            canSendMessage={Boolean(item.canSendMessage)}
            currentUserId={user?.id}
            onPress={() =>
              handleRoomPress(item.roomId, item.roomName, Boolean(item.canSendMessage))
            }
          />
        )}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 32,
              paddingTop: 80,
            }}
          >
            <Ionicons name="chatbubbles-outline" size={56} color="#C5CAE9" />
            <Text
              style={{
                fontSize: 16,
                color: "#5C6BC0",
                marginTop: 12,
                textAlign: "center",
              }}
            >
              No chats in this community yet.
            </Text>
          </View>
        }
        contentContainerStyle={
          communityRooms.length === 0 ? { flex: 1 } : undefined
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
