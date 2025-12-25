// components/chat/MessagesList.tsx
import { useCallback, useMemo } from 'react';
import { FlatList, ViewToken } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { Message } from '@/types/type';
import { flattenMessagesWithDates, FlatListItem } from '@/utils/messageHelpers';
import SwipeableMessage from './messages/SwipeableMessage';
import MessageBubble from './messages/MessageBubble';
import DateSeparator from './DateSeparator';
import EmptyMessages from './EmptyMessages';

interface MessagesListProps {
  flatListRef: React.RefObject<FlatList>;
  messages: Message[];
  currentUserId: string;
  isGroupAdmin: boolean;
  selectedMessages: Message[];
  showPollModal: boolean;
  activePollId: number | null;
  blinkProgress: SharedValue<number>;
  isMessageHighlighted: (messageId: string | number) => boolean;
  isMessageSelected: (messageId: string | number) => boolean;
  onMessagePress: (message: Message) => void;
  onMessageLongPress: (message: Message) => void;
  onReply: (message: Message) => void;
  onMediaGridPress: (mediaFiles: any[], selectedIndex: number) => void;
  onOpenTable: (tableId: number) => void;
  onOpenPoll: (pollId: number) => void;
  onReplyPreviewClick: (messageId: string | number) => void;
  onScroll: (event: any) => void;
  onViewableItemsChanged: (info: { viewableItems: ViewToken[] }) => void;
  onLayout: () => void;
  onContentSizeChange: () => void;
}

const MessagesList: React.FC<MessagesListProps> = ({
  flatListRef,
  messages,
  currentUserId,
  isGroupAdmin,
  selectedMessages,
  showPollModal,
  activePollId,
  blinkProgress,
  isMessageHighlighted,
  isMessageSelected,
  onMessagePress,
  onMessageLongPress,
  onReply,
  onMediaGridPress,
  onOpenTable,
  onOpenPoll,
  onReplyPreviewClick,
  onScroll,
  onViewableItemsChanged,
  onLayout,
  onContentSizeChange,
}) => {
  const flatData = useMemo(() => flattenMessagesWithDates(messages), [messages]);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: FlatListItem }) => {
      if (item.type === 'date') {
        return <DateSeparator date={item.date!} />;
      }

      const message = item.message!;
      const isOwnMessage = message.senderId === currentUserId;
      const isSelected = isMessageSelected(message.id);
      const isHighlighted = isMessageHighlighted(message.id);

      return (
        <SwipeableMessage
          message={message}
          onReply={onReply}
          onPress={onMessagePress}
          onLongPress={onMessageLongPress}
          isSelected={isSelected}
          enabled={isGroupAdmin && !isSelected && selectedMessages.length === 0}
        >
          <MessageBubble
            message={message}
            isOwnMessage={isOwnMessage}
            showPollModal={showPollModal}
            activePollId={activePollId}
            isHighlighted={isHighlighted}
            blinkProgress={blinkProgress}
            onMediaGridPress={onMediaGridPress}
            onOpenTable={onOpenTable}
            onOpenPoll={onOpenPoll}
            onReplyPreviewClick={onReplyPreviewClick}
          />
        </SwipeableMessage>
      );
    },
    [
      currentUserId,
      isGroupAdmin,
      selectedMessages.length,
      showPollModal,
      activePollId,
      blinkProgress,
      isMessageSelected,
      isMessageHighlighted,
      onMessagePress,
      onMessageLongPress,
      onReply,
      onMediaGridPress,
      onOpenTable,
      onOpenPoll,
      onReplyPreviewClick,
    ]
  );

  const keyExtractor = useCallback((item: FlatListItem) => item.id, []);

  return (
    <FlatList
      ref={flatListRef}
      data={flatData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={{ paddingVertical: 10 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onLayout={onLayout}
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={<EmptyMessages isGroupAdmin={isGroupAdmin} />}
      removeClippedSubviews={true}
      maxToRenderPerBatch={15}
      windowSize={10}
      initialNumToRender={20}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
    />
  );
};

export default React.memo(MessagesList);