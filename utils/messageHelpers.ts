// utils/messageHelpers.ts
import { Message } from '@/types/type';
import { formatISTDate } from '@/utils/dateUtils';
import { MessageStatus } from '@/types/chat.types';

export interface GroupedMessages {
  [date: string]: Message[];
}

export interface FlatListItem {
  type: 'date' | 'message';
  date?: string;
  message?: Message;
  id: string;
}

export const groupMessagesByDate = (messages: Message[]): GroupedMessages => {
  const grouped: GroupedMessages = {};

  messages.forEach((message) => {
    const date = formatISTDate(message.createdAt, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: undefined,
      minute: undefined,
      hour12: undefined,
    });

    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(message);
  });

  return grouped;
};

export const flattenMessagesWithDates = (messages: Message[]): FlatListItem[] => {
  // Sort messages by timestamp
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const grouped = groupMessagesByDate(sortedMessages);
  const dateKeys = Object.keys(grouped).sort((a, b) => {
    const firstMessageA = grouped[a][0];
    const firstMessageB = grouped[b][0];
    return new Date(firstMessageA.createdAt).getTime() - new Date(firstMessageB.createdAt).getTime();
  });

  const flatData: FlatListItem[] = [];

  dateKeys.forEach((date) => {
    flatData.push({ type: 'date', date, id: `date-${date}` });
    grouped[date].forEach((message) => {
      flatData.push({ type: 'message', message, id: message.id.toString() });
    });
  });

  return flatData;
};

export const formatDateForDisplay = (dateString: string): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayIST = formatISTDate(today, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: undefined,
    minute: undefined,
    hour12: undefined,
  });

  const yesterdayIST = formatISTDate(yesterday, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: undefined,
    minute: undefined,
    hour12: undefined,
  });

  if (dateString === todayIST) return 'Today';
  if (dateString === yesterdayIST) return 'Yesterday';
  return dateString;
};

export const getMessageStatus = (message: Message): MessageStatus => {
  if (typeof message.id === 'number') {
    return 'delivered';
  }
  if (typeof message.id === 'string' && message.id.includes('temp')) {
    return 'sending';
  }
  return 'sent';
};

export const getReplyPreviewText = (message: Message): string => {
  if (message.messageType === 'media') return '📁 Media Files';
  if (message.messageType === 'poll') return '📊 Poll';
  if (message.messageType === 'table') return '📋 Table';
  return message.messageText || 'Message';
};