// context/ChatContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import { 
  User, 
  Message, 
  ChatRoom, 
  ChatUser 
} from '@/types/type';

interface ChatContextType {
  socket: Socket | null;
  chatRooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  messages: Message[];
  chatUsers: ChatUser[];
  loadingMessages: boolean;
  loadingRooms: boolean;
  typingUsers: Record<string, string>;
  setChatRooms: React.Dispatch<React.SetStateAction<ChatRoom[]>>;
  setCurrentRoom: React.Dispatch<React.SetStateAction<ChatRoom | null>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  fetchChatRooms: () => Promise<void>;
  fetchMessages: (roomId: number) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  createOrGetDirectMessageRoom: (otherUserId: number) => Promise<number>;
  createGroupRoom: (name: string, description: string, memberIds: number[]) => Promise<number>;
  fetchChatUsers: () => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  checkAuthentication: () => Promise<boolean>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AuthStorage.getUser();
        if (userData) {
          setUser(userData);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    const newSocket = io(API_URL);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Setup socket listeners
  useEffect(() => {
    if (!socket || !user) return;

    // Authenticate with socket
    socket.emit('authenticate', user.id);

    // New message handler
    socket.on('new_message', (message: Message) => {
      setMessages(prev => [message, ...prev]);
      
      // Update unread count in chat rooms
      if (message.sender_id !== user.id) {
        setChatRooms(prev => 
          prev.map(room => 
            room.id === message.room_id 
              ? { 
                  ...room, 
                  last_message: message.content,
                  last_activity: message.created_at,
                  unread_count: currentRoom?.id === room.id ? 0 : (room.unread_count || 0) + 1
                } 
              : room
          )
        );
      }
    });

    // Message notification handler
    socket.on('message_notification', ({ roomId, message }) => {
      if (currentRoom?.id !== roomId) {
        // Play notification sound or show notification
        // TODO: Implement notification handling
      }
    });

    // Typing indicator handler
    socket.on('user_typing', ({ userId, userName, isTyping }) => {
      if (isTyping) {
        setTypingUsers(prev => ({ ...prev, [userId]: userName }));
      } else {
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      }
    });

    return () => {
      socket.off('new_message');
      socket.off('message_notification');
      socket.off('user_typing');
    };
  }, [socket, user, currentRoom]);

  // Join room when current room changes
  useEffect(() => {
    if (!socket || !currentRoom) return;

    // Leave previous room if any
    if (currentRoom) {
      socket.emit('join_room', currentRoom.id);
    }

    return () => {
      if (currentRoom) {
        socket.emit('leave_room', currentRoom.id);
      }
    };
  }, [socket, currentRoom]);

  const fetchChatRooms = async () => {
    if (!user) return;
    
    setLoadingRooms(true);
    try {
      const response = await fetch(`${API_URL}/api/chat/rooms/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch chat rooms');
      
      const data = await response.json();
      setChatRooms(data);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchMessages = async (roomId: number) => {
    if (!user) return;
    
    setLoadingMessages(true);
    try {
      const response = await fetch(`${API_URL}/api/chat/messages/${roomId}?userId=${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      setMessages(data);

      // Update unread count in chat rooms
      setChatRooms(prev => 
        prev.map(room => 
          room.id === roomId 
            ? { ...room, unread_count: 0 } 
            : room
        )
      );
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!user || !currentRoom || !socket) return;
    
    try {
      // Emit socket event
      socket.emit('send_message', {
        roomId: currentRoom.id,
        senderId: user.id,
        content
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const createOrGetDirectMessageRoom = async (otherUserId: number): Promise<number> => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const response = await fetch(`${API_URL}/api/chat/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          otherUserId
        })
      });
      
      if (!response.ok) throw new Error('Failed to create DM room');
      
      const data = await response.json();
      await fetchChatRooms(); // Refresh chat rooms
      return data.roomId;
    } catch (error) {
      console.error('Error creating DM room:', error);
      throw error;
    }
  };

  const createGroupRoom = async (name: string, description: string, memberIds: number[]): Promise<number> => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const response = await fetch(`${API_URL}/api/chat/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          creatorId: user.id,
          memberIds
        })
      });
      
      if (!response.ok) throw new Error('Failed to create group room');
      
      const data = await response.json();
      await fetchChatRooms(); // Refresh chat rooms
      return data.roomId;
    } catch (error) {
      console.error('Error creating group room:', error);
      throw error;
    }
  };

  const fetchChatUsers = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${API_URL}/api/chat/users/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch chat users');
      
      const data = await response.json();
      setChatUsers(data);
    } catch (error) {
      console.error('Error fetching chat users:', error);
    }
  };

  const setTyping = (isTyping: boolean) => {
    if (!socket || !user || !currentRoom) return;
    
    socket.emit('typing', {
      roomId: currentRoom.id,
      userId: user.id,
      userName: user.full_name,
      isTyping
    });
  };

  // Check authentication method
  const checkAuthentication = async (): Promise<boolean> => {
    const token = await AuthStorage.getToken();
    if (!token) {
      // Clear socket and user if no token
      socket?.disconnect();
      setUser(null);
      return false;
    }
    return true;
  };

  return (
    <ChatContext.Provider
      value={{
        socket,
        chatRooms,
        currentRoom,
        messages,
        chatUsers,
        loadingMessages,
        loadingRooms,
        typingUsers,
        setChatRooms,
        setCurrentRoom,
        setMessages,
        fetchChatRooms,
        fetchMessages,
        sendMessage,
        createOrGetDirectMessageRoom,
        createGroupRoom,
        fetchChatUsers,
        setTyping,
        checkAuthentication
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};