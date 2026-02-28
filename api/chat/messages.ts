// api/chat/messages.ts
import { api, apiUrl } from "@/api/apiClient";

export const getScheduledMessages = async (roomId: string) => {
  const response = await api.get(
    apiUrl(`/api/chat/rooms/${roomId}/scheduled-messages`)
  );
  return response.data;
};

export const getNewMessages = async (
  roomId: string,
  afterTimestamp?: string,
  limit: number = 50
) => {
  const params: Record<string, string | number> = { limit };
  if (afterTimestamp) params.afterTimestamp = afterTimestamp;

  const response = await api.get(
    apiUrl(`/api/chat/rooms/${roomId}/messages`),
    { params }
  );
  return response.data.messages || [];
};

export const sendMessage = async (
  roomId: string,
  data: {
    messageText: string;
    messageType: string;
    mediaFilesId?: number;
    pollId?: number | null;
    tableId?: number;
    replyMessageId?: number;
    scheduledAt?: string;
    isForward?: boolean;
    forwardSourcePollId?: number;
    forwardSourceMediaId?: number;
  }
) => {
  const response = await api.post(
    apiUrl(`/api/chat/rooms/${roomId}/messages`),
    data
  );
  return response.data;
};

export const editMessage = async (
  roomId: string | number,
  messageId: string | number,
  messageText: string
) => {
  const response = await api.put(
    apiUrl(`/api/chat/rooms/${roomId}/messages/${messageId}`),
    { messageText }
  );
  return response.data;
};

export const deleteMessages = async (
  roomId: string | number,
  messageIds: (string | number)[]
) => {
  const response = await api.delete(
    apiUrl(`/api/chat/rooms/${roomId}/messages`),
    { data: { messageIds } }
  );
  return response.data;
};

export const markMessageAsRead = async (messageId: number) => {
  const response = await api.post(
    apiUrl(`/api/chat/messages/${messageId}/mark-read`),
    {}
  );
  return response.data;
};

export const markAllMessagesAsRead = async (roomId: string) => {
  const response = await api.post(
    apiUrl(`/api/chat/rooms/${roomId}/mark-read`),
    {}
  );
  return response.data;
};

export const getMessageReadStatus = async (messageId: string | number) => {
  const response = await api.get(
    apiUrl(`/api/chat/messages/${messageId}/read-status`)
  );
  return response.data;
};
