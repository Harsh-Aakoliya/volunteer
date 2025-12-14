import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ChatRoom, Message } from '@/types/type';

export interface AuthUser {
  userId: string;
  fullName?: string | null;
  role?: string | null;
  mobileNumber?: string | null;
}

export interface LastMessageData {
  createdAt: string;
  id: number;
  mediaFilesId: number | null;
  messageText: string;
  messageType: string;
  pollId: number | null;
  replyMessageId?: number | null;
  sender: {
    userId: string;
    userName: string;
  };
  tableId: number | null;
}

export type ExtendedChatRoom = Partial<ChatRoom> & {
  unreadCount?: number;
  lastMessage?: LastMessageData;
  onlineCount?: number;
};

type MessagesByRoom = Record<string, Message[]>;
type LastMessagesMap = Record<string, LastMessageData>;
type UnreadCountsMap = Record<string, number>;
type OnlineUsersMap = Record<string, string[]>;
type UserStatusMap = Record<string, boolean>;

interface AppState {
  // Auth
  authUser: AuthUser | null;
  token: string | null;
  isHydrated: boolean;

  // Chat data
  chatRooms: ExtendedChatRoom[];
  lastMessages: LastMessagesMap;
  unreadCounts: UnreadCountsMap;
  messagesByRoom: MessagesByRoom;

  // Presence
  onlineUsersByRoom: OnlineUsersMap;
  userOnlineStatus: UserStatusMap;
  currentUserOnline: boolean;

  // Actions
  setAuthUser: (user: AuthUser | null, token?: string | null) => void;
  clearAuth: () => void;

  setChatRooms: (rooms: ExtendedChatRoom[]) => void;
  upsertChatRooms: (rooms: ExtendedChatRoom[]) => void;
  setLastMessages: (data: LastMessagesMap) => void;
  updateLastMessage: (roomId: string, data: LastMessageData) => void;
  setUnreadCounts: (data: UnreadCountsMap) => void;
  setMessagesForRoom: (roomId: string, messages: Message[]) => void;
  addMessageToRoom: (roomId: string, message: Message) => void;

  setOnlineUsersForRoom: (roomId: string, onlineUsers: string[], onlineCount?: number) => void;
  setUserOnlineStatus: (userId: string, isOnline: boolean) => void;
  setCurrentUserOnline: (isOnline: boolean) => void;

  setHydrated: (value: boolean) => void;
}

const mergeRooms = (existing: ExtendedChatRoom[], incoming: ExtendedChatRoom[]): ExtendedChatRoom[] => {
  const map = new Map<string | number, ExtendedChatRoom>();
  existing.forEach((room) => {
    if (room.roomId) {
      map.set(room.roomId, room);
    }
  });
  incoming.forEach((room) => {
    if (room.roomId) {
      const prev = map.get(room.roomId) || {};
      map.set(room.roomId, { ...prev, ...room });
    }
  });
  return Array.from(map.values());
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      authUser: null,
      token: null,
      isHydrated: false,

      chatRooms: [],
      lastMessages: {},
      unreadCounts: {},
      messagesByRoom: {},

      onlineUsersByRoom: {},
      userOnlineStatus: {},
      currentUserOnline: false,

      setAuthUser: (user, token) =>
        set((state) => ({
          authUser: user,
          token: token ?? state.token,
        })),

      clearAuth: () =>
        set({
          authUser: null,
          token: null,
          chatRooms: [],
          lastMessages: {},
          unreadCounts: {},
          messagesByRoom: {},
          onlineUsersByRoom: {},
          userOnlineStatus: {},
          currentUserOnline: false,
        }),

      setChatRooms: (rooms) => set({ chatRooms: rooms }),

      upsertChatRooms: (rooms) =>
        set((state) => ({
          chatRooms: mergeRooms(state.chatRooms, rooms),
        })),

      setLastMessages: (data) =>
        set((state) => ({
          lastMessages: { ...state.lastMessages, ...data },
        })),

      updateLastMessage: (roomId, data) =>
        set((state) => ({
          lastMessages: { ...state.lastMessages, [roomId]: data },
          chatRooms: state.chatRooms.map((room) =>
            room.roomId?.toString() === roomId ? { ...room, lastMessage: data } : room
          ),
        })),

      setUnreadCounts: (data) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, ...data },
          chatRooms: state.chatRooms.map((room) => {
            const roomIdStr = room.roomId?.toString();
            if (roomIdStr && data[roomIdStr] !== undefined) {
              return { ...room, unreadCount: data[roomIdStr] };
            }
            return room;
          }),
        })),

      setMessagesForRoom: (roomId, messages) =>
        set((state) => ({
          messagesByRoom: { ...state.messagesByRoom, [roomId]: messages },
        })),

      addMessageToRoom: (roomId, message) =>
        set((state) => {
          const existing = state.messagesByRoom[roomId] || [];
          const alreadyPresent = existing.some((m) => m.id === message.id);
          return {
            messagesByRoom: {
              ...state.messagesByRoom,
              [roomId]: alreadyPresent ? existing : [...existing, message],
            },
          };
        }),

      setOnlineUsersForRoom: (roomId, onlineUsers, onlineCount) =>
        set((state) => ({
          onlineUsersByRoom: { ...state.onlineUsersByRoom, [roomId]: onlineUsers },
          chatRooms: state.chatRooms.map((room) =>
            room.roomId?.toString() === roomId && onlineCount !== undefined
              ? { ...room, onlineCount }
              : room
          ),
        })),

      setUserOnlineStatus: (userId, isOnline) =>
        set((state) => ({
          userOnlineStatus: { ...state.userOnlineStatus, [userId]: isOnline },
        })),

      setCurrentUserOnline: (isOnline) => set({ currentUserOnline: isOnline }),

      setHydrated: (value) => set({ isHydrated: value }),
    }),
    {
      name: 'volunteer-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        authUser: state.authUser,
        token: state.token,
        chatRooms: state.chatRooms,
        lastMessages: state.lastMessages,
        unreadCounts: state.unreadCounts,
        messagesByRoom: state.messagesByRoom,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

export const appStore = {
  getState: useAppStore.getState,
  setState: useAppStore.setState,
  subscribe: useAppStore.subscribe,
};
