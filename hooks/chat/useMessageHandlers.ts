// hooks/chat/useMessageHandlers.ts
import { useState, useCallback } from 'react';
import axios from 'axios';
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import socketService from '@/utils/socketService';
import { Message } from '@/types/type';
import { CurrentUser } from '@/types/chat.types';

interface UseMessageHandlersOptions {
  roomId: string;
  currentUser: CurrentUser | null;
  isGroupAdmin: boolean;
  replyToMessage: Message | null;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string | number, message: Partial<Message>) => void;
  removeTempMessages: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setMessagesSet: React.Dispatch<React.SetStateAction<Set<string | number>>>;
  loadScheduledMessages: () => void;
  onSendComplete?: () => void;
}

export const useMessageHandlers = ({
  roomId,
  currentUser,
  isGroupAdmin,
  replyToMessage,
  addMessage,
  updateMessage,
  removeTempMessages,
  setMessages,
  setMessagesSet,
  loadScheduledMessages,
  onSendComplete,
}: UseMessageHandlersOptions) => {
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');

  const sendMessage = useCallback(
    async (
      text: string,
      messageType: string,
      mediaFilesId?: number,
      pollId?: number,
      tableId?: number,
      replyMessageId?: number,
      scheduledAt?: string
    ) => {
      if (!isGroupAdmin) {
        alert('Only group admins can send messages in this room.');
        return;
      }

      if ((!text.trim() && !mediaFilesId && !pollId && !tableId) || !roomId || !currentUser || sending) {
        return;
      }

      const trimmedMessage = text.trim();

      try {
        setSending(true);
        setMessageText('');

        // Create optimistic message
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          roomId: parseInt(roomId),
          senderId: currentUser.userId,
          senderName: currentUser.fullName || 'You',
          messageText: trimmedMessage,
          messageType: messageType,
          createdAt: new Date().toISOString(),
          mediaFilesId,
          pollId,
          tableId,
          replyMessageId,
          ...(replyMessageId && replyToMessage && {
            replySenderName: replyToMessage.senderName,
            replyMessageText: replyToMessage.messageText,
            replyMessageType: replyToMessage.messageType,
          }),
        };

        addMessage(optimisticMessage);

        const token = await AuthStorage.getToken();
        const response = await axios.post(
          `${API_URL}/api/chat/rooms/${roomId}/messages`,
          {
            messageText: trimmedMessage,
            mediaFilesId,
            pollId,
            messageType,
            tableId,
            replyMessageId,
            scheduledAt,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.success && response.data.scheduledMessage) {
          loadScheduledMessages();
          removeTempMessages();
          return;
        }

        const newMessages = Array.isArray(response.data) ? response.data : [response.data];

        const messagesWithSenderName = newMessages.map((msg) => ({
          ...msg,
          senderName: currentUser.fullName || 'You',
          ...(msg.replyMessageId && replyToMessage && {
            replySenderName: replyToMessage.senderName,
            replyMessageText: replyToMessage.messageText,
            replyMessageType: replyToMessage.messageType,
          }),
        }));

        // Replace optimistic messages with real ones
        setMessages((prev) => {
          const filteredMessages = prev.filter(
            (msg) => !(typeof msg.id === 'string' && msg.id.includes('temp'))
          );
          return [...filteredMessages, ...messagesWithSenderName];
        });

        setMessagesSet((prev) => {
          const newSet = new Set(prev);
          Array.from(newSet).forEach((id) => {
            if (typeof id === 'string' && id.includes('temp')) {
              newSet.delete(id);
            }
          });
          messagesWithSenderName.forEach((msg) => newSet.add(msg.id));
          return newSet;
        });

        // Send via socket
        messagesWithSenderName.forEach((newMessage) => {
          socketService.sendMessage(roomId, newMessage, {
            userId: currentUser.userId,
            userName: currentUser.fullName || 'Anonymous',
          });
        });

        onSendComplete?.();
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
        setMessageText(trimmedMessage);
        removeTempMessages();
      } finally {
        setSending(false);
      }
    },
    [
      roomId,
      currentUser,
      isGroupAdmin,
      replyToMessage,
      sending,
      addMessage,
      removeTempMessages,
      setMessages,
      setMessagesSet,
      loadScheduledMessages,
      onSendComplete,
    ]
  );

  const deleteMessages = useCallback(
    async (messageIds: (string | number)[]) => {
      try {
        const token = await AuthStorage.getToken();
        await axios.delete(`${API_URL}/api/chat/rooms/${roomId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { messageIds },
        });
      } catch (error) {
        console.error('Error deleting messages:', error);
        throw error;
      }
    },
    [roomId]
  );

  const markMessageAsRead = useCallback(async (messageId: string | number) => {
    try {
      const token = await AuthStorage.getToken();
      await axios.post(
        `${API_URL}/api/chat/messages/${messageId}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, []);

  return {
    sending,
    messageText,
    setMessageText,
    sendMessage,
    deleteMessages,
    markMessageAsRead,
  };
};