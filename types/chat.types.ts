// types/chat.types.ts
import { Message, ChatRoom, ChatUser } from "@/types/type";

export interface RoomDetails extends ChatRoom {
  members: ChatUser[];
  messages: Message[];
}

export interface CurrentUser {
  userId: string;
  fullName: string | null;
}

export interface ReadStatusData {
  readBy: Array<{ userId: string; fullName: string; readAt: string }>;
  unreadBy: Array<{ userId: string; fullName: string }>;
}

export interface MessageAnimationConfig {
  swipeThreshold: number;
  velocityThreshold: number;
  maxTranslation: number;
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "error";

export interface ChatRoomState {
  room: RoomDetails | null;
  messages: Message[];
  isLoading: boolean;
  sending: boolean;
  messageText: string;
  isGroupAdmin: boolean;
  onlineUsers: string[];
  currentUser: CurrentUser | null;
  roomMembers: ChatUser[];
  selectedMessages: Message[];
  isReplying: boolean;
  replyToMessage: Message | null;
  showScrollToBottom: boolean;
  isNearBottom: boolean;
}

export interface SwipeGestureContext {
  startX: number;
  triggeredHaptic: boolean;
}