import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { Message } from "@/types/type";
import { formatISTTime, formatISTDate } from "@/utils/dateUtils";
import MediaGrid from "./MediaGrid";
import StyledTextMessage from "./StyledTextMessage";
import MediaViewerModal from "./MediaViewerModal";
import { getReplyPreviewText } from "@/utils/messageHelpers";

interface InfoMessageModalProps {
  visible: boolean;
  onClose: () => void;
  message: Message | null;
}

interface ReadStatusData {
  readBy: Array<{ userId: string; fullName: string; readAt: string }>;
  unreadBy: Array<{ userId: string; fullName: string }>;
}

const InfoMessageModal: React.FC<InfoMessageModalProps> = ({
  visible,
  onClose,
  message,
}) => {
  const [data, setData] = useState<ReadStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);

  const fetchStatus = async () => {
    if (!message?.id) return;
    try {
      if (!refreshing) setLoading(true);
      const token = await AuthStorage.getToken();
      const response = await axios.get(
        `${API_URL}/api/chat/messages/${message.id}/read-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        console.log("response.data.data", response.data.data);
        let data = response.data.data;
        data.readBy = data.readBy.filter((item: any) => item.userId !== message.senderId);
        data.unreadBy = data.unreadBy.filter((item: any) => item.userId !== message.senderId);
        setData(data);
      }
    } catch (err) {
      console.error("Error fetching read status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (visible && message) {
      fetchStatus();
    }
  }, [visible, message?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const handleMediaPress = (files: any[], index: number) => {
    setMediaFiles(files);
    setMediaIndex(index);
    setShowMediaViewer(true);
  };

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  if (!message) return null;

  const previewReplyText =
    message.replyMessageId && message.replyMessageType
      ? getReplyPreviewText({
          messageType: message.replyMessageType,
          messageText: message.replyMessageText,
        } as Message)
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "white" }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">
            Message Info
          </Text>
          <TouchableOpacity onPress={handleRefresh} className="p-2">
            <Ionicons name="refresh" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Animated.ScrollView
          style={{ flex: 1 }}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Message preview - collapsible */}
          <Animated.View
            style={{
              opacity: headerHeight,
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [0, 80],
                    outputRange: [0, -20],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          >
            <View className="m-4 p-3 rounded-xl bg-[#F4F4F5]">
              {previewReplyText && (
                <View className="mb-2 border-l-2 border-[#0088CC] pl-2">
                  <Text className="text-xs font-semibold text-[#0088CC] mb-0.5">
                    {message.replySenderName}
                  </Text>
                  <Text
                    className="text-[13px] text-[#4B5563]"
                    numberOfLines={3}
                  >
                    {previewReplyText}
                  </Text>
                </View>
              )}

              {message.messageType === "text" && message.messageText && (
                <StyledTextMessage
                  content={message.messageText}
                  isOwnMessage={false}
                />
              )}

              {message.messageType === "media" && (
                <View>
                  <MediaGrid
                    messageId={message.id}
                    mediaFilesId={message.mediaFilesId || 0}
                    onMediaPress={handleMediaPress}
                    isOwnMessage={false}
                  />
                  {message.messageText && message.messageText.trim() !== "" && (
                    <View className="mt-2">
                      <StyledTextMessage
                        content={message.messageText}
                        isOwnMessage={false}
                      />
                    </View>
                  )}
                </View>
              )}

              {message.messageType === "poll" && (
                <View>
                  <Text className="text-base leading-[22px] text-black">
                    shared poll: {message.pollId}
                  </Text>
                  {message.messageText && message.messageText.trim() !== "" && (
                    <View className="mt-2">
                      <StyledTextMessage
                        content={message.messageText}
                        isOwnMessage={false}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          </Animated.View>

          {/* Seen By */}
          <View className="px-4 pt-2 pb-4 border-b border-gray-200">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              Seen by
            </Text>
            {loading && !data ? (
              <Text className="text-xs text-gray-400">Loading...</Text>
            ) : data && data.readBy.length > 0 ? (
              data.readBy.map((u) => (
                <View
                  key={u.userId}
                  className="flex-row items-center py-1.5"
                >
                  <View className="w-8 h-8 rounded-full bg-[#E5E7EB] items-center justify-center mr-3">
                    <Text className="text-xs font-semibold text-[#374151]">
                      {u.fullName?.slice(0, 2)?.toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-[#111827]">{u.fullName}</Text>
                    <Text className="text-xs text-[#6B7280]">
                      {formatISTDate(u.readAt)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-xs text-gray-400">No one has seen yet</Text>
            )}
          </View>

          {/* Delivered To */}
          <View className="px-4 pt-3 pb-6">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              Delivered to
            </Text>
            {loading && !data ? (
              <Text className="text-xs text-gray-400">Loading...</Text>
            ) : data && data.unreadBy.length > 0 ? (
              data.unreadBy.map((u) => (
                <View
                  key={u.userId}
                  className="flex-row items-center py-1.5"
                >
                  <View className="w-8 h-8 rounded-full bg-[#E5E7EB] items-center justify-center mr-3">
                    <Text className="text-xs font-semibold text-[#374151]">
                      {u.fullName?.slice(0, 2)?.toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-[#111827]">{u.fullName}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-xs text-gray-400">
                Delivered to all participants
              </Text>
            )}
          </View>
        </Animated.ScrollView>

        {/* Media viewer */}
        <MediaViewerModal
          visible={showMediaViewer}
          onClose={() => setShowMediaViewer(false)}
          mediaFiles={mediaFiles}
          initialIndex={mediaIndex}
        />
      </View>
    </Modal>
  );
};

export default InfoMessageModal;

