// components/chat/messages/MessageBubble.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolateColor,
  SharedValue,
} from 'react-native-reanimated';
import { Message } from '@/types/type';
import { formatISTTime } from '@/utils/dateUtils';
import { getReplyPreviewText, getMessageStatus } from '@/utils/messageHelpers';
import MessageStatus from '@/components/chat/MessageStatus';
import MessageContent from '@/components/chat/messages/MessageContent';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showPollModal: boolean;
  activePollId: number | null;
  isHighlighted?: boolean;
  blinkProgress?: SharedValue<number>;
  onMediaGridPress: (mediaFiles: any[], selectedIndex: number) => void;
  onOpenTable: (tableId: number) => void;
  onOpenPoll: (pollId: number) => void;
  onReplyPreviewClick: (messageId: string | number) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  showPollModal,
  activePollId,
  isHighlighted,
  blinkProgress,
  onMediaGridPress,
  onOpenTable,
  onOpenPoll,
  onReplyPreviewClick,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = screenWidth - 100;
  
  const messageStatus = getMessageStatus(message);

  // Animated style for highlight effect
  const animatedBubbleStyle = useAnimatedStyle(() => {
    if (!blinkProgress || !isHighlighted) {
      return {
        backgroundColor: isOwnMessage ? '#dbeafe' : '#f3f4f6',
      };
    }

    return {
      backgroundColor: interpolateColor(
        blinkProgress.value,
        [0, 1],
        [isOwnMessage ? '#dbeafe' : '#f3f4f6', '#fbbf24']
      ),
    };
  }, [isHighlighted, isOwnMessage]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        isOwnMessage ? styles.ownBubble : styles.otherBubble,
        animatedBubbleStyle,
      ]}
    >
      {/* Reply Preview */}
      {message.replyMessageId && (
        <TouchableOpacity
          style={[
            styles.replyPreview,
            isOwnMessage ? styles.ownReplyPreview : styles.otherReplyPreview,
          ]}
          onPress={() => onReplyPreviewClick(message.replyMessageId!)}
        >
          <Text
            style={[
              styles.replySenderName,
              isOwnMessage ? styles.ownReplyText : styles.otherReplyText,
            ]}
          >
            {message.replySenderName}
          </Text>
          <Text
            style={[
              styles.replyMessageText,
              isOwnMessage ? styles.ownReplyMessageText : styles.otherReplyMessageText,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {getReplyPreviewText({
              messageType: message.replyMessageType,
              messageText: message.replyMessageText,
            } as Message)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Sender Name (for other's messages) */}
      {!isOwnMessage && (
        <Text style={styles.senderName}>{message.senderName || 'Unknown'}</Text>
      )}

      {/* Message Content */}
      <MessageContent
        message={message}
        isOwnMessage={isOwnMessage}
        contentWidth={contentWidth}
        showPollModal={showPollModal}
        activePollId={activePollId}
        onMediaGridPress={onMediaGridPress}
        onOpenTable={onOpenTable}
        onOpenPoll={onOpenPoll}
      />

      {/* Footer: Time, Status, Edited */}
      <View style={styles.footer}>
        <Text style={[styles.time, isOwnMessage ? styles.ownTime : styles.otherTime]}>
          {formatISTTime(message.editedAt || message.createdAt)}
        </Text>
        {isOwnMessage && (
          <View style={styles.statusContainer}>
            <MessageStatus status={messageStatus} />
          </View>
        )}
        {message.isEdited && (
          <Text style={[styles.edited, isOwnMessage ? styles.ownTime : styles.otherTime]}>
            edited
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    maxWidth: '85%',
  },
  ownBubble: {
    alignSelf: 'flex-end',
    marginLeft: 64,
    backgroundColor: '#dbeafe',
  },
  otherBubble: {
    alignSelf: 'flex-start',
    marginRight: 64,
    backgroundColor: '#f3f4f6',
  },
  replyPreview: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 2,
  },
  ownReplyPreview: {
    backgroundColor: '#bfdbfe',
    borderLeftColor: '#3b82f6',
  },
  otherReplyPreview: {
    backgroundColor: '#e5e7eb',
    borderLeftColor: '#6b7280',
  },
  replySenderName: {
    fontSize: 12,
    fontWeight: '600',
  },
  ownReplyText: {
    color: '#2563eb',
  },
  otherReplyText: {
    color: '#4b5563',
  },
  replyMessageText: {
    fontSize: 14,
    marginTop: 2,
  },
  ownReplyMessageText: {
    color: '#1e40af',
  },
  otherReplyMessageText: {
    color: '#1f2937',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 12,
  },
  ownTime: {
    color: '#4b5563',
  },
  otherTime: {
    color: '#6b7280',
  },
  statusContainer: {
    marginLeft: 4,
  },
  edited: {
    fontSize: 12,
    fontStyle: 'italic',
    marginLeft: 4,
  },
});

export default React.memo(MessageBubble);