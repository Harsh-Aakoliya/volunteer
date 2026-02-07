// app/chat/[roomId]/scheduled.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getScheduledMessages } from '@/api/chat';
import { formatISTTime } from '@/utils/dateUtils';
import { getReplyPreviewText } from '@/utils/messageHelpers';
import StyledTextMessage from '@/components/chat/StyledTextMessage';
import MediaGrid from '@/components/chat/MediaGrid';
import PollMessage from '@/components/chat/PollMessage';
import { Message } from '@/types/type';

export default function ScheduledMessagesScreen() {
  const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName?: string }>();
  const insets = useSafeAreaInsets();
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScheduled = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const response = await getScheduledMessages(roomId);
      if (response.success) {
        setScheduledMessages(response.scheduledMessages || []);
      }
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  const mapToMessage = (row: any): Message => ({
    id: row.id,
    roomId: row.roomId,
    senderId: row.senderId,
    senderName: row.senderName || 'Unknown',
    messageText: row.messageText || '',
    messageType: row.messageType || 'text',
    createdAt: row.createdAt,
    mediaFilesId: row.mediaFilesId,
    pollId: row.pollId,
    tableId: row.tableId,
    replyMessageId: row.replyMessageId,
    replySenderName: row.replySenderName,
    replyMessageText: row.replyMessageText,
    replyMessageType: row.replyMessageType,
  });

  const renderMessageBubble = ({ item }: { item: any }) => {
    const message = mapToMessage(item);
    const isOwnMessage = true; // Scheduled messages are always from current user

    return (
      <View className="px-3 py-2">
        <View
          className="max-w-[75%] self-end px-3 pt-2 pb-1.5 ml-[60px] bg-[#DCF8C6] rounded-[18px] shadow-sm"
          style={{ borderTopRightRadius: 4 }}
        >
          {message.replyMessageId && (
            <View className="py-1.5 px-2.5 mb-1.5 rounded-lg border-l-[3px] bg-black/5 border-l-[#4CAF50]">
              <Text className="text-xs font-semibold text-[#0088CC] mb-0.5">
                {message.replySenderName || 'Unknown'}
              </Text>
              <Text className="text-[13px] text-[#666]" numberOfLines={3} ellipsizeMode="tail">
                {getReplyPreviewText({
                  messageType: message.replyMessageType,
                  messageText: message.replyMessageText,
                } as Message)}
              </Text>
            </View>
          )}

          {message.messageType === 'text' && (
            <StyledTextMessage content={message.messageText} isOwnMessage={isOwnMessage} />
          )}

          {message.messageType === 'media' && (
            <View>
              <MediaGrid
                messageId={message.id}
                onMediaPress={() => {}}
                mediaFilesId={message.mediaFilesId || 0}
                isOwnMessage
              />
              {message.messageText && message.messageText.trim() !== '' && (
                <View className="mt-1">
                  <StyledTextMessage content={message.messageText} isOwnMessage={isOwnMessage} />
                </View>
              )}
            </View>
          )}

          {message.messageType === 'poll' && (
            <View>
              {typeof message.pollId === 'number' && (
                <PollMessage pollId={message.pollId} currentUserId="" onViewResults={() => {}} />
              )}
              {message.messageText && message.messageText.trim() !== '' && (
                <View className="mt-1">
                  <StyledTextMessage content={message.messageText} isOwnMessage={isOwnMessage} />
                </View>
              )}
            </View>
          )}

          <View className="flex-row items-center justify-end mt-1 gap-1">
            <Ionicons name="time-outline" size={14} color="#8E8E93" />
            <Text className="text-[11px] text-[#8E8E93]">
              Sends at {formatISTTime(message.createdAt || '')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#E5DDD5', paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 py-2.5 bg-white border-b border-[#E5E5E5]">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text className="flex-1 text-[17px] font-semibold text-black ml-2" numberOfLines={1}>
          Scheduled Messages
        </Text>
        <TouchableOpacity onPress={loadScheduled} className="p-2">
          <Ionicons name="refresh" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0088CC" />
        </View>
      ) : scheduledMessages.length === 0 ? (
        <View className="flex-1 justify-center items-center py-8">
          <Ionicons name="time-outline" size={60} color="#d1d5db" />
          <Text className="text-gray-500 mt-4 text-center">No scheduled messages</Text>
        </View>
      ) : (
        <FlatList
          data={scheduledMessages}
          keyExtractor={(item) => `scheduled-${item.id}`}
          renderItem={renderMessageBubble}
          contentContainerStyle={{ paddingVertical: 10 }}
          inverted
        />
      )}
    </View>
  );
}
