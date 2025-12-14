// hooks/chat/useChatRoom.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import axios from 'axios';
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import socketService from '@/utils/socketService';
import { clearRoomNotifications } from '@/utils/chatNotificationHandler';
import { Message, ChatUser } from '@/types/type';
import { RoomDetails, CurrentUser, ChatRoomState } from '@/types/chat.types';
import { getScheduledMessages } from '@/api/chat';

interface UseChatRoomOptions {
  roomId: string;
}

export const useChatRoom = ({ roomId }: UseChatRoomOptions) => {
  // State
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesSet, setMessagesSet] = useState<Set<string | number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [roomMembers, setRoomMembers] = useState<ChatUser[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Message helper functions
  const addMessage = useCallback((message: Message) => {
    setMessagesSet((prev) => {
      if (prev.has(message.id)) return prev;
      return new Set(prev).add(message.id);
    });
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  const removeMessage = useCallback((messageId: string | number) => {
    setMessagesSet((prev) => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  }, []);

  const updateMessage = useCallback((messageId: string | number, updatedMessage: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, ...updatedMessage } : msg
      )
    );
  }, []);

  const removeTempMessages = useCallback(() => {
    setMessages((prev) =>
      prev.filter((msg) => !(typeof msg.id === 'string' && msg.id.includes('temp')))
    );
    setMessagesSet((prev) => {
      const newSet = new Set(prev);
      Array.from(newSet).forEach((id) => {
        if (typeof id === 'string' && id.includes('temp')) {
          newSet.delete(id);
        }
      });
      return newSet;
    });
  }, []);

  // Load scheduled messages
  const loadScheduledMessages = useCallback(async () => {
    if (!roomId) return;
    try {
      const response = await getScheduledMessages(roomId);
      if (response.success) {
        setScheduledMessages(response.scheduledMessages);
      }
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
    }
  }, [roomId]);

  // Load room details
  const loadRoomDetails = useCallback(async () => {
    try {
      setIsLoading(true);

      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUser({
          userId: userData.userId,
          fullName: userData.fullName || null,
        });
      }

      const token = await AuthStorage.getToken();
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRoom(response.data);
      const initialMessages = response.data.messages || [];
      setMessages(initialMessages);
      setMessagesSet(new Set(initialMessages.map((msg: Message) => msg.id)));

      const isUserGroupAdmin = response.data.members.some(
        (member: ChatUser) => member.userId === userData?.userId && member.isAdmin
      );
      setIsGroupAdmin(isUserGroupAdmin);

      const initialMembers = response.data.members.map((member: ChatUser) => ({
        ...member,
        isOnline: false,
      }));
      setRoomMembers(initialMembers);

      if (userData) {
        socketService.joinRoom(roomId, userData.userId, userData.fullName || 'Anonymous');
        clearRoomNotifications(roomId);
        loadScheduledMessages();
      }
    } catch (error) {
      console.error('Error loading room details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, loadScheduledMessages]);

  // Socket connection and listeners
  useEffect(() => {
    socketService.connect();
  }, []);

  useEffect(() => {
    if (!roomId || !currentUser) return;

    socketService.joinRoom(roomId, currentUser.userId, currentUser.fullName || 'Anonymous');

    // Online users listener
    socketService.onOnlineUsers(({ roomId: updatedRoomId, onlineUsers: users }) => {
      if (updatedRoomId === roomId) {
        setOnlineUsers(users);
      }
    });

    // Room members listener
    socketService.onRoomMembers(({ roomId: updatedRoomId, members }) => {
      if (updatedRoomId === roomId) {
        setRoomMembers(members);
      }
    });

    // New message listener
    socketService.onNewMessage((data) => {
      if (data.roomId === roomId && data.sender.userId !== currentUser.userId) {
        const newMessage: Message = {
          id: data.id,
          roomId: parseInt(data.roomId),
          senderId: data.sender.userId,
          senderName: data.sender.userName,
          messageText: data.messageText,
          messageType: data.messageType,
          createdAt: data.createdAt,
          mediaFilesId: data?.mediaFilesId,
          pollId: data?.pollId,
          tableId: data?.tableId,
        };
        addMessage(newMessage);
      }
    });

    // Message deleted listener
    socketService.onMessagesDeleted((data) => {
      if (data.roomId === roomId) {
        data.messageIds.forEach((messageId: string | number) => {
          removeMessage(messageId);
        });
      }
    });

    // Message edited listener
    socketService.onMessageEdited((data) => {
      if (data.roomId === roomId) {
        updateMessage(data.messageId, {
          messageText: data.messageText,
          isEdited: data.isEdited,
          editedAt: data.editedAt,
          editedBy: data.editedBy,
          editorName: data.editorName,
        });
      }
    });

    return () => {
      socketService.leaveRoom(roomId, currentUser.userId);
    };
  }, [roomId, currentUser, addMessage, removeMessage, updateMessage]);

  // App state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        loadRoomDetails();

        if (!socketService.socket?.connected && currentUser && roomId) {
          const socket = socketService.connect();
          if (socket) {
            socketService.identify(currentUser.userId);
            socketService.joinRoom(roomId, currentUser.userId, currentUser.fullName || 'Anonymous');
          }
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [currentUser, roomId, loadRoomDetails]);

  return {
    // State
    room,
    messages,
    isLoading,
    currentUser,
    isGroupAdmin,
    onlineUsers,
    roomMembers,
    scheduledMessages,
    
    // Actions
    loadRoomDetails,
    loadScheduledMessages,
    addMessage,
    removeMessage,
    updateMessage,
    removeTempMessages,
    setMessages,
    setMessagesSet,
    setRoomMembers,
    setOnlineUsers,
  };
};