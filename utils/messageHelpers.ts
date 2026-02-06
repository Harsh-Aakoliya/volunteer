// utils/messageHelpers.ts
import { Message } from '@/types/type';
import { formatISTDate } from '@/utils/dateUtils';
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

export const getMessageStatus = (message: Message) => {
  if (typeof message.id === 'number') {
    return 'delivered';
  }
  if (typeof message.id === 'string' && message.id.includes('temp')) {
    return 'sending';
  }
  return 'sent';
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

export const getReplyPreviewText = (message: Message): string => {
  if (!message) return 'Message';
  
  switch (message.messageType) {
    case 'media':
      // For media, show messageText if exists (caption), else show "Media"
      if (message.messageText && message.messageText.trim() !== '') {
        return stripHtmlTags(message.messageText);
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
      // For text messages, strip HTML and return
      if (message.messageText) {
        const cleaned = stripHtmlTags(message.messageText);
        return cleaned || 'Message';
      }
      return 'Message';
  }
};