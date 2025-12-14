// app/chat/[roomId].tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Message, ChatRoom } from '@/types/type';

// Hooks
import { useChatRoom } from '@/hooks/chat/useChatRoom';
import { useMessageHandlers } from '@/hooks/chat/useMessageHandlers';
import { useMessageSelection } from '@/hooks/chat/useMessageSelection';
import { useScrollBehavior } from '@/hooks/chat/useScrollBehavior';
import socketService from '@/utils/socketService';

// Components
import MessagesList from '@/components/chat/MessagesList';
import MessageInput from '@/components/chat/MessageInput';
import ChatMessageOptions from '@/components/chat/ChatMessageOptions';
import ScrollToBottomButton from '@/components/chat/ScrollToBottomButton';
import ReplyPreview from '@/components/chat/ReplyPreview';

// Modals
import GlobalPollModal from '@/components/chat/GlobalPollModal';
import MediaViewerModal from '@/components/chat/MediaViewerModal';
import ForwardMessagesModal from '@/components/chat/ForwardMessagesModal';
import ReadStatusModal from '@/components/chat/ReadStatusModal';
import ScheduledMessagesModal from '@/components/chat/ScheduledMessagesModal';

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const navigation = useNavigation();

  // Core chat room logic
  const {
    room,
    messages,
    isLoading,
    currentUser,
    isGroupAdmin,
    onlineUsers,
    roomMembers,
    scheduledMessages,
    loadRoomDetails,
    loadScheduledMessages,
    addMessage,
    updateMessage,
    removeTempMessages,
    setMessages,
    setMessagesSet,
    setRoomMembers,
    setOnlineUsers,
  } = useChatRoom({ roomId: roomId! });

  // Reply state
  const [isReplying, setIsReplying] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  // Message handlers
  const {
    sending,
    messageText,
    setMessageText,
    sendMessage,
    deleteMessages,
    markMessageAsRead,
  } = useMessageHandlers({
    roomId: roomId!,
    currentUser,
    isGroupAdmin,
    replyToMessage,
    addMessage,
    updateMessage,
    removeTempMessages,
    setMessages,
    setMessagesSet,
    loadScheduledMessages,
    onSendComplete: () => {
      setIsReplying(false);
      setReplyToMessage(null);
    },
  });

  // Message selection
  const {
    selectedMessages,
    setSelectedMessages,
    isMessageSelected,
    handleMessageLongPress,
    handleMessagePress,
    clearSelection,
    hasSelection,
  } = useMessageSelection({ isGroupAdmin });

  // Scroll behavior
  const {
    flatListRef,
    showScrollToBottom,
    isNearBottom,
    scrollToBottom,
    scrollToMessage,
    handleScroll,
    isMessageHighlighted,
    blinkProgress,
  } = useScrollBehavior({ messages });

  // Modal states
  const [showPollModal, setShowPollModal] = useState(false);
  const [activePollId, setActivePollId] = useState<number | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableId, setTableId] = useState<number | null>(null);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<any[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReadStatus, setShowReadStatus] = useState(false);
  const [selectedMessageForReadStatus, setSelectedMessageForReadStatus] = useState<Message | null>(null);
  const [readStatusData, setReadStatusData] = useState<any>(null);
  const [isLoadingReadStatus, setIsLoadingReadStatus] = useState(false);
  const [showScheduledMessages, setShowScheduledMessages] = useState(false);

  // Load room on focus
  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        loadRoomDetails();
      }
      return () => {
        clearSelection();
        setIsReplying(false);
        setReplyToMessage(null);
        setActivePollId(null);
        setShowPollModal(false);
      };
    }, [roomId])
  );

  // Set navigation options
  useEffect(() => {
    if (room) {
      navigation.setOptions({
        tabBarStyle: { display: 'none' },
        headerTitle: () => (
          <TouchableOpacity
          onPress={() => router.push({ 
            pathname: '/chat/room-info', 
            params: { 
              roomId,
              roomName: room.roomName,
              roomDescription: room.roomDescription || '',
              membersData: JSON.stringify(roomMembers),
              onlineUsersData: JSON.stringify(onlineUsers),
              isGroupAdmin: isGroupAdmin ? 'true' : 'false',
            } 
          })}
          className="flex-row items-center flex-1"
          >
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="people" size={20} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                {room.roomName}
              </Text>
              <Text className="text-xs text-gray-500">
                {onlineUsers.length}/{roomMembers.length} online
              </Text>
            </View>
          </TouchableOpacity>
        ),
        headerRight: () => null,
      });
    }
  }, [room, onlineUsers.length, roomMembers.length]);

  // Handlers
  const handleStartReply = useCallback((message: Message) => {
    setReplyToMessage(message);
    setIsReplying(true);
    clearSelection();
  }, [clearSelection]);

  const handleCancelReply = useCallback(() => {
    setReplyToMessage(null);
    setIsReplying(false);
  }, []);

  const handleMediaGridPress = useCallback((mediaFiles: any[], selectedIndex: number) => {
    setSelectedMediaFiles(mediaFiles);
    setSelectedMediaIndex(selectedIndex);
    setShowMediaViewer(true);
  }, []);

  const handleOpenPoll = useCallback((pollId: number) => {
    if (!showPollModal) {
      setActivePollId(pollId);
      setShowPollModal(true);
    }
  }, [showPollModal]);

  const handleOpenTable = useCallback((tableId: number) => {
    setTableId(tableId);
    setShowTableModal(true);
  }, []);

  const handleSendMessage = useCallback(
    (text: string, messageType: string, scheduledAt?: string) => {
      sendMessage(text, messageType, undefined, undefined, undefined, replyToMessage?.id as number, scheduledAt);
    },
    [sendMessage, replyToMessage]
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (currentUser) {
        viewableItems.forEach((item: any) => {
          const message = item.item?.message;
          if (message && message.senderId !== currentUser.userId && typeof message.id === 'number') {
            markMessageAsRead(message.id);
          }
        });
      }
    },
    [currentUser, markMessageAsRead]
  );

  // Scroll handlers for FlatList
  const handleLayout = useCallback(() => {
    setTimeout(() => {
      if (flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToEnd({ animated: false });
      }
    }, 100);
  }, [messages.length]);

  const handleContentSizeChange = useCallback(() => {
    if (isNearBottom) {
      setTimeout(() => {
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    }
  }, [isNearBottom, messages.length]);

  // Listen for user online status updates
  useEffect(() => {
    const handleUserStatus = (data: { userId: string; isOnline: boolean }) => {
      setRoomMembers(prevMembers =>
        prevMembers.map(member =>
          member.userId === data.userId ? { ...member, isOnline: data.isOnline } : member
        )
      );

      if (data.isOnline) {
        setOnlineUsers(prev => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      }
    };

    socketService.socket?.on("userOnlineStatusUpdate", handleUserStatus);

    return () => {
      socketService.socket?.off("userOnlineStatusUpdate", handleUserStatus);
    };
  }, [setRoomMembers, setOnlineUsers]);

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  // Error state
  if (!room) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Ionicons name="alert-circle-outline" size={60} color="#d1d5db" />
        <Text className="text-gray-500 mt-4 text-center">
          Chat room not found or you don't have access.
        </Text>
        <TouchableOpacity
          className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Selection Header */}
          {hasSelection && isGroupAdmin && (
            <ChatMessageOptions
              selectedMessages={selectedMessages}
              setSelectedMessages={setSelectedMessages}
              isAdmin={isGroupAdmin}
              onClose={clearSelection}
              onForwardPress={() => setShowForwardModal(true)}
              onDeletePress={deleteMessages}
              onInfoPress={(message) => {
                setSelectedMessageForReadStatus(message);
                setShowReadStatus(true);
              }}
              roomId={roomId}
              roomMembers={roomMembers}
              currentUser={currentUser}
              onMessageEdited={(msg) => updateMessage(msg.id, msg)}
            />
          )}

          {/* Messages List */}
          <MessagesList
            flatListRef={flatListRef}
            messages={messages}
            currentUserId={currentUser?.userId || ''}
            isGroupAdmin={isGroupAdmin}
            selectedMessages={selectedMessages}
            showPollModal={showPollModal}
            activePollId={activePollId}
            blinkProgress={blinkProgress}
            isMessageHighlighted={isMessageHighlighted}
            isMessageSelected={isMessageSelected}
            onMessagePress={handleMessagePress}
            onMessageLongPress={handleMessageLongPress}
            onReply={handleStartReply}
            onMediaGridPress={handleMediaGridPress}
            onOpenTable={handleOpenTable}
            onOpenPoll={handleOpenPoll}
            onReplyPreviewClick={scrollToMessage}
            onScroll={handleScroll}
            onViewableItemsChanged={handleViewableItemsChanged}
            onLayout={handleLayout}
            onContentSizeChange={handleContentSizeChange}
          />

          {/* Scroll to Bottom Button */}
          <ScrollToBottomButton visible={showScrollToBottom} onPress={scrollToBottom} />

          {/* Reply Preview */}
          {isReplying && replyToMessage && isGroupAdmin && (
            <ReplyPreview message={replyToMessage} onCancel={handleCancelReply} />
          )}

          {/* Message Input */}
          {isGroupAdmin ? (
            <View className="px-4 py-2 bg-white">
              <MessageInput
                messageText={messageText}
                onChangeText={setMessageText}
                onSend={handleSendMessage}
                sending={sending}
                disabled={false}
                roomMembers={roomMembers}
                currentUser={currentUser}
                roomId={roomId}
                showAttachments={true}
                onScheduleMessage={() => setShowScheduledMessages(true)}
                hasScheduledMessages={scheduledMessages.length > 0}
                onFocus={() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
                style={{
                  borderTopWidth: 0,
                  borderTopColor: 'transparent',
                  backgroundColor: 'transparent',
                  paddingHorizontal: 0,
                }}
              />
            </View>
          ) : (
            <View className="p-4 border-t border-gray-200 bg-gray-50">
              <Text className="text-center text-gray-600 text-sm">
                Only group admins can send messages in this room
              </Text>
            </View>
          )}

          {/* Modals */}
          <MediaViewerModal
            visible={showMediaViewer}
            onClose={() => {
              setShowMediaViewer(false);
              setSelectedMediaFiles([]);
              setSelectedMediaIndex(0);
            }}
            mediaFiles={selectedMediaFiles}
            initialIndex={selectedMediaIndex}
          />

          {isGroupAdmin && (
            <ForwardMessagesModal
              visible={showForwardModal}
              onClose={() => setShowForwardModal(false)}
              selectedMessages={selectedMessages}
              currentRoomId={roomId}
              onForward={async (rooms, msgs) => {
                // Forward logic...
                clearSelection();
                setShowForwardModal(false);
              }}
            />
          )}

          <GlobalPollModal
            pollId={activePollId}
            visible={showPollModal}
            onClose={() => {
              setShowPollModal(false);
              setActivePollId(null);
            }}
            currentUserId={currentUser?.userId || ''}
            totalMembers={roomMembers.length}
          />

          <ReadStatusModal
            visible={showReadStatus}
            onClose={() => setShowReadStatus(false)}
            isLoading={isLoadingReadStatus}
            data={readStatusData}
            selectedMessage={selectedMessageForReadStatus}
            onRefresh={() => {}}
          />

          <ScheduledMessagesModal
            visible={showScheduledMessages}
            onClose={() => setShowScheduledMessages(false)}
            messages={scheduledMessages}
            onRefresh={loadScheduledMessages}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}