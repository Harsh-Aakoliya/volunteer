// contexts/SocketContext.tsx
// React Context for centralized socket state management

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import socketManager, {
  SocketUser,
  LastMessage,
  ChatMessage,
  RoomUpdate,
  OnlineUsersUpdate,
  MemberInfo,
  MessageEditedEvent,
  MessagesDeletedEvent,
  RoomMetadata,
  RoomData,
} from "@/utils/socketManager";
import { ChatRoomStorage } from "@/utils/chatRoomsStorage";
import { AuthStorage } from "@/utils/authStorage";

// ==================== TYPES ====================

interface SocketState {
  isConnected: boolean;
  isInitialized: boolean;
  user: SocketUser | null;
  rooms: RoomData[];  // Unified rooms data
  lastMessages: Record<string, LastMessage>;  // Keep for real-time updates
  unreadCounts: Record<string, number>;  // Keep for real-time updates
  roomMetadata: Record<string, RoomMetadata>;  // Keep for real-time updates
}

interface SocketContextValue extends SocketState {
  // Initialize connection
  initialize: () => Promise<boolean>;
  
  // Disconnect
  disconnect: () => void;
  
  // Request fresh room data
  refreshRoomData: () => void;
  
  // Room actions
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  
  // Message actions
  sendMessage: (roomId: string, message: Partial<ChatMessage>) => void;
  
  // Mark room as read (local state only)
  markRoomAsRead: (roomId: string) => void;
  
  // Get online users for a room
  requestOnlineUsers: (roomId: string) => void;
}

// ==================== CONTEXT ====================

const SocketContext = createContext<SocketContextValue | null>(null);

// ==================== PROVIDER ====================

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    isInitialized: false,
    user: null,
    rooms: [],
    lastMessages: {},
    unreadCounts: {},
    roomMetadata: {},
  });

  const subscriptionIds = useRef<number[]>([]);
  const initializingRef = useRef(false);

  // Initialize socket connection
  const initialize = useCallback(async (): Promise<boolean> => {
    if (initializingRef.current || state.isInitialized) {
      return state.isConnected;
    }

    initializingRef.current = true;

    try {
      const userData = await AuthStorage.getUser();
      const token = await AuthStorage.getToken();

      if (!userData?.userId || !token) {
        console.log("❌ [SocketContext] No user data");
        initializingRef.current = false;
        return false;
      }

      const user: SocketUser = {
        id: userData.userId,
        name: userData.fullName || userData.sevakname || "Unknown",
      };

      console.log("🚀 [SocketContext] Initializing for user:", user.id);

      const connected = await socketManager.connect(user);

      if (connected) {
        setupSubscriptions();

        if (Platform.OS !== "web") {
          socketManager.startAppStateListener();
        }

        socketManager.requestRoomData();

        setState((prev) => ({
          ...prev,
          isConnected: true,
          isInitialized: true,
          user,
        }));

        console.log("✅ [SocketContext] Initialized");
      }

      initializingRef.current = false;
      return connected;
    } catch (error) {
      console.error("❌ [SocketContext] Init error:", error);
      initializingRef.current = false;
      return false;
    }
  }, [state.isInitialized, state.isConnected]);

  // Set up event subscriptions
  const setupSubscriptions = useCallback(() => {
    // Clear existing
    subscriptionIds.current.forEach((id) => socketManager.off(id));
    subscriptionIds.current = [];

    // Connection changes
    const connSub = socketManager.on("connectionChange", ({ connected }) => {
      setState((prev) => ({ ...prev, isConnected: connected }));
      // When socket connects, automatically request room data to sync with server
      if (connected) {
        console.log("📡 [SocketContext] Socket connected, requesting room data...");
        socketManager.requestRoomData();
      }
    });
    subscriptionIds.current.push(connSub);

    // Last messages
    const lastMsgSub = socketManager.on<Record<string, LastMessage>>(
      "lastMessages",
      (messages) => {
        setState((prev) => ({
          ...prev,
          lastMessages: { ...prev.lastMessages, ...messages },
        }));
      }
    );
    subscriptionIds.current.push(lastMsgSub);

    // Unread counts
    const unreadSub = socketManager.on<Record<string, number>>(
      "unreadCounts",
      (counts) => {
        setState((prev) => ({
          ...prev,
          unreadCounts: { ...prev.unreadCounts, ...counts },
        }));
      }
    );
    subscriptionIds.current.push(unreadSub);

    // Room metadata (roomName, canSendMessage, isAdmin) - for individual updates
    const metadataSub = socketManager.on<Record<string, RoomMetadata>>(
      "roomMetadata",
      (metadata) => {
        setState((prev) => ({
          ...prev,
          roomMetadata: { ...prev.roomMetadata, ...metadata },
        }));
      }
    );
    subscriptionIds.current.push(metadataSub);

    // Unified rooms data - single event with all room info
    const roomsDataSub = socketManager.on<RoomData[]>(
      "roomsData",
      (rooms) => {
        console.log("📦 [SocketContext] Received rooms data:", rooms.length);
        setState((prev) => ({
          ...prev,
          rooms,
        }));
        // Save to cache
        const cacheRooms = rooms.map((r) => ({
          roomId: parseInt(r.roomId),
          roomName: r.roomName,
          isAdmin: r.isAdmin,
          canSendMessage: r.canSendMessage,
          lastMessage: r.lastMessage ? {
            id: r.lastMessage.id,
            messageText: r.lastMessage.text,
            messageType: r.lastMessage.messageType,
            createdAt: r.lastMessage.timestamp,
            roomId: r.roomId,
            sender: {
              userId: r.lastMessage.senderId,
              userName: r.lastMessage.senderName,
            },
            replyMessageId: r.lastMessage.replyMessageId,
            replyMessageType: r.lastMessage.replyMessageType,
            replyMessageText: r.lastMessage.replyMessageText,
            replySenderName: r.lastMessage.replySenderName,
          } : undefined,
          unreadCount: r.unreadCount,
        }));
        ChatRoomStorage.saveChatRooms(cacheRooms as any);
      }
    );
    subscriptionIds.current.push(roomsDataSub);

    // Room updates - this is sent to ALL room members (even those not in the room)
    // This is the main event for updating the rooms list on the main page
    const roomUpdateSub = socketManager.on<RoomUpdate>("roomUpdate", (data) => {
      console.log("🔄 [SocketContext] Room update for:", data.roomId);
      
      setState((prev) => {
        // Update rooms array with new last message
        const updatedRooms = prev.rooms.map((r) => {
          if (r.roomId === data.roomId) {
            // Convert lastMessage from old format to new format
            let newLastMessage = r.lastMessage;
            if (data.lastMessage) {
              let displayText = data.lastMessage.messageText;
              if (data.lastMessage.messageType !== 'text') {
                const typeMap: Record<string, string> = {
                  'media': 'shared media',
                  'poll': 'shared poll',
                  'table': 'shared table',
                  'announcement': 'shared announcement'
                };
                displayText = typeMap[data.lastMessage.messageType] || data.lastMessage.messageText;
              }
              
              newLastMessage = {
                  replyMessageId: 0, replyMessageText: "", replyMessageType: "", replySenderName: "",
                  id: data.lastMessage.id,
                text: displayText,
                messageType: data.lastMessage.messageType,
                senderName: data.lastMessage.sender?.userName || 'Unknown',
                senderId: data.lastMessage.sender?.userId || '',
                timestamp: data.lastMessage.createdAt
              };
            }
            
            return {
              ...r,
              lastMessage: newLastMessage,
              unreadCount: data.unreadCount !== undefined ? data.unreadCount : r.unreadCount,
            };
          }
          return r;
        });

        // Save to cache
        if (updatedRooms.length > 0) {
          const cacheRooms = updatedRooms.map((r) => ({
            roomId: parseInt(r.roomId),
            roomName: r.roomName,
            isAdmin: r.isAdmin,
            canSendMessage: r.canSendMessage,
            lastMessage: r.lastMessage ? {
              id: r.lastMessage.id,
              messageText: r.lastMessage.text,
              messageType: r.lastMessage.messageType,
              createdAt: r.lastMessage.timestamp,
              roomId: r.roomId,
              sender: {
                userId: r.lastMessage.senderId,
                userName: r.lastMessage.senderName,
              },
            } : undefined,
            unreadCount: r.unreadCount,
          }));
          ChatRoomStorage.saveChatRooms(cacheRooms as any);
        }

        return {
          ...prev,
          rooms: updatedRooms,
          lastMessages: data.lastMessage 
            ? { ...prev.lastMessages, [data.roomId]: data.lastMessage }
            : prev.lastMessages,
          unreadCounts: data.unreadCount !== undefined
            ? { ...prev.unreadCounts, [data.roomId]: data.unreadCount }
            : prev.unreadCounts,
        };
      });
    });
    subscriptionIds.current.push(roomUpdateSub);

    // New message - update rooms array and cache
    const newMessageSub = socketManager.on<ChatMessage>("newMessage", (message) => {
      console.log("📨 [SocketContext] New message in room:", message.roomId);
      
      // Determine display text based on message type
      let displayText = message.messageText;
      if (message.messageType !== 'text') {
        const typeMap: Record<string, string> = {
          'media': 'shared media',
          'poll': 'shared poll',
          'table': 'shared table',
          'announcement': 'shared announcement'
        };
        displayText = typeMap[message.messageType] || message.messageText;
      }

      setState((prev) : any=> {
        const isFromCurrentUser = String(message.senderId || '') === String(prev.user?.id ?? '');
        const updatedRooms = prev.rooms.map((r) => {
          if (r.roomId === message.roomId.toString()) {
            return {
              ...r,
              lastMessage: {
                id: typeof message.id === "number" ? message.id : parseInt(message.id as string) || 0,
                text: displayText,
                messageType: message.messageType,
                senderName: message.senderName,
                senderId: message.senderId,
                timestamp: message.createdAt,
              },
              unreadCount: !isFromCurrentUser
                ? (r.unreadCount || 0) + 1
                : (r.unreadCount ?? 0),
            };
          }
          return r;
        });

        // Save to cache
        if (updatedRooms.length > 0) {
          const cacheRooms = updatedRooms.map((r) => ({
            roomId: parseInt(r.roomId),
            roomName: r.roomName,
            isAdmin: r.isAdmin,
            canSendMessage: r.canSendMessage,
            lastMessage: r.lastMessage ? {
              id: r.lastMessage.id,
              messageText: r.lastMessage.text,
              messageType: r.lastMessage.messageType,
              createdAt: r.lastMessage.timestamp,
              roomId: r.roomId,
              sender: {
                userId: r.lastMessage.senderId,
                userName: r.lastMessage.senderName,
              },
            } : undefined,
            unreadCount: r.unreadCount,
          }));
          ChatRoomStorage.saveChatRooms(cacheRooms as any);
        }

        return { ...prev, rooms: updatedRooms };
      });
    });
    subscriptionIds.current.push(newMessageSub);

    // Message edited - update rooms array and cache
    const messageEditedSub2 = socketManager.on<MessageEditedEvent>("messageEdited", (data) => {
      console.log("✏️ [SocketContext] Message edited in room:", data.roomId);
      
      setState((prev) => {
        const updatedRooms = prev.rooms.map((r) => {
          if (r.roomId === data.roomId && r.lastMessage?.id === data.messageId) {
            return {
              ...r,
              lastMessage: {
                ...r.lastMessage,
                text: data.messageText,
              },
            };
          }
          return r;
        });

        // Save to cache if changed
        const hasChange = updatedRooms.some((r, i) => r !== prev.rooms[i]);
        if (hasChange) {
          const cacheRooms = updatedRooms.map((r) => ({
            roomId: parseInt(r.roomId),
            roomName: r.roomName,
            isAdmin: r.isAdmin,
            canSendMessage: r.canSendMessage,
            lastMessage: r.lastMessage ? {
              id: r.lastMessage.id,
              messageText: r.lastMessage.text,
              messageType: r.lastMessage.messageType,
              createdAt: r.lastMessage.timestamp,
              roomId: r.roomId,
              sender: {
                userId: r.lastMessage.senderId,
                userName: r.lastMessage.senderName,
              },
            } : undefined,
            unreadCount: r.unreadCount,
          }));
          ChatRoomStorage.saveChatRooms(cacheRooms as any);
        }

        return { ...prev, rooms: updatedRooms };
      });
    });
    subscriptionIds.current.push(messageEditedSub2);

    // Messages deleted - refresh from server
    const messagesDeletedSub2 = socketManager.on<MessagesDeletedEvent>("messagesDeleted", (data) => {
      console.log("🗑️ [SocketContext] Messages deleted in room:", data.roomId);
      // Refresh room data from server to get accurate state
      socketManager.requestRoomData();
    });
    subscriptionIds.current.push(messagesDeletedSub2);
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    subscriptionIds.current.forEach((id) => socketManager.off(id));
    subscriptionIds.current = [];
    socketManager.stopAppStateListener();
    socketManager.disconnect();
    setState({
      isConnected: false,
      isInitialized: false,
      user: null,
      rooms: [],
      lastMessages: {},
      unreadCounts: {},
      roomMetadata: {},
    });
  }, []);

  // Refresh room data
  const refreshRoomData = useCallback(() => {
    socketManager.requestRoomData();
  }, []);

  // Join room
  const joinRoom = useCallback((roomId: string) => {
    socketManager.joinRoom(roomId);
    // Clear unread count for this room
    setState((prev) => ({
      ...prev,
      unreadCounts: { ...prev.unreadCounts, [roomId]: 0 },
    }));
  }, []);

  // Leave room
  const leaveRoom = useCallback((roomId: string) => {
    socketManager.leaveRoom(roomId);
  }, []);

  // Send message
  const sendMessage = useCallback(
    (roomId: string, message: Partial<ChatMessage>) => {
      socketManager.sendMessage(roomId, message);
    },
    []
  );

  // Mark room as read (local only)
  const markRoomAsRead = useCallback((roomId: string) => {
    setState((prev) => ({
      ...prev,
      rooms: prev.rooms.map(r => r.roomId === roomId ? { ...r, unreadCount: 0 } : r),
      unreadCounts: { ...prev.unreadCounts, [roomId]: 0 },
    }));
  }, []);

  // Request online users
  const requestOnlineUsers = useCallback((roomId: string) => {
    socketManager.requestOnlineUsers(roomId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      subscriptionIds.current.forEach((id) => socketManager.off(id));
    };
  }, []);

  const contextValue: SocketContextValue = {
    ...state,
    initialize,
    disconnect,
    refreshRoomData,
    joinRoom,
    leaveRoom,
    sendMessage,
    markRoomAsRead,
    requestOnlineUsers,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

// ==================== HOOKS ====================

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}

// Hook for room list subscriptions
interface UseRoomListOptions {
  onRoomUpdate?: (data: RoomUpdate) => void;
  onOnlineUsers?: (data: OnlineUsersUpdate) => void;
  onNewMessage?: (data: ChatMessage) => void;
  onMessageEdited?: (data: MessageEditedEvent) => void;
  onMessagesDeleted?: (data: MessagesDeletedEvent) => void;
}

export function useRoomListSubscription(options: UseRoomListOptions) {
  const { isConnected } = useSocket();

  // Store callbacks in refs to always use latest version
  const callbackRefs = useRef({
    onRoomUpdate: options.onRoomUpdate,
    onOnlineUsers: options.onOnlineUsers,
    onNewMessage: options.onNewMessage,
    onMessageEdited: options.onMessageEdited,
    onMessagesDeleted: options.onMessagesDeleted,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbackRefs.current = {
      onRoomUpdate: options.onRoomUpdate,
      onOnlineUsers: options.onOnlineUsers,
      onNewMessage: options.onNewMessage,
      onMessageEdited: options.onMessageEdited,
      onMessagesDeleted: options.onMessagesDeleted,
    };
  }, [options.onRoomUpdate, options.onOnlineUsers, options.onNewMessage, options.onMessageEdited, options.onMessagesDeleted]);

  useEffect(() => {
    if (!isConnected) return;

    const subIds: number[] = [];

    // Room update subscription
    const roomUpdateId = socketManager.on("roomUpdate", (data: RoomUpdate) => {
      callbackRefs.current.onRoomUpdate?.(data);
    });
    subIds.push(roomUpdateId);

    // Online users subscription
    const onlineUsersId = socketManager.on("onlineUsers", (data: OnlineUsersUpdate) => {
      callbackRefs.current.onOnlineUsers?.(data);
    });
    subIds.push(onlineUsersId);

    // New message subscription (for room list updates)
    const newMessageId = socketManager.on("newMessage", (data: ChatMessage) => {
      callbackRefs.current.onNewMessage?.(data);
    });
    subIds.push(newMessageId);

    // Message edited subscription
    const messageEditedId = socketManager.on("messageEdited", (data: MessageEditedEvent) => {
      callbackRefs.current.onMessageEdited?.(data);
    });
    subIds.push(messageEditedId);

    // Messages deleted subscription
    const messagesDeletedId = socketManager.on("messagesDeleted", (data: MessagesDeletedEvent) => {
      callbackRefs.current.onMessagesDeleted?.(data);
    });
    subIds.push(messagesDeletedId);

    return () => {
      subIds.forEach((id) => socketManager.off(id));
    };
  }, [isConnected]);
}

// Hook for chat room subscriptions
interface UseChatRoomOptions {
  roomId: string;
  onNewMessage?: (message: ChatMessage) => void;
  onMessageEdited?: (data: MessageEditedEvent) => void;
  onMessagesDeleted?: (data: MessagesDeletedEvent) => void;
  onOnlineUsers?: (data: OnlineUsersUpdate) => void;
  onRoomMembers?: (data: { roomId: string; members: MemberInfo[] }) => void;
}

export function useChatRoomSubscription(options: UseChatRoomOptions) {
  const { isConnected, joinRoom, leaveRoom, requestOnlineUsers } = useSocket();
  const hasJoined = useRef(false);

  // Store callbacks in refs to avoid re-subscribing on every callback change
  const callbackRefs = useRef({
    onNewMessage: options.onNewMessage,
    onMessageEdited: options.onMessageEdited,
    onMessagesDeleted: options.onMessagesDeleted,
    onOnlineUsers: options.onOnlineUsers,
    onRoomMembers: options.onRoomMembers,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbackRefs.current = {
      onNewMessage: options.onNewMessage,
      onMessageEdited: options.onMessageEdited,
      onMessagesDeleted: options.onMessagesDeleted,
      onOnlineUsers: options.onOnlineUsers,
      onRoomMembers: options.onRoomMembers,
    };
  }, [options.onNewMessage, options.onMessageEdited, options.onMessagesDeleted, options.onOnlineUsers, options.onRoomMembers]);

  useEffect(() => {
    if (!isConnected || !options.roomId) return;

    // Join room once
    if (!hasJoined.current) {
      joinRoom(options.roomId);
      requestOnlineUsers(options.roomId);
      hasJoined.current = true;
    }

    const subIds: number[] = [];

    // Subscribe to newMessage - use ref to always call latest callback
    const newMessageId = socketManager.on<ChatMessage>("newMessage", (msg) => {
      if (msg.roomId.toString() === options.roomId) {
        callbackRefs.current.onNewMessage?.(msg);
      }
    });
    subIds.push(newMessageId);

    // Subscribe to messageEdited
    const messageEditedId = socketManager.on<MessageEditedEvent>("messageEdited", (data) => {
      if (data.roomId === options.roomId) {
        callbackRefs.current.onMessageEdited?.(data);
      }
    });
    subIds.push(messageEditedId);

    // Subscribe to messagesDeleted
    const messagesDeletedId = socketManager.on<MessagesDeletedEvent>("messagesDeleted", (data) => {
      if (data.roomId === options.roomId) {
        callbackRefs.current.onMessagesDeleted?.(data);
      }
    });
    subIds.push(messagesDeletedId);

    // Subscribe to onlineUsers
    const onlineUsersId = socketManager.on<OnlineUsersUpdate>("onlineUsers", (data) => {
      if (data.roomId === options.roomId) {
        callbackRefs.current.onOnlineUsers?.(data);
      }
    });
    subIds.push(onlineUsersId);

    // Subscribe to roomMembers
    const roomMembersId = socketManager.on("roomMembers", (data: { roomId: string; members: MemberInfo[] }) => {
      if (data.roomId === options.roomId) {
        callbackRefs.current.onRoomMembers?.(data);
      }
    });
    subIds.push(roomMembersId);

    return () => {
      subIds.forEach((id) => socketManager.off(id));
      if (hasJoined.current) {
        leaveRoom(options.roomId);
        hasJoined.current = false;
      }
    };
  }, [isConnected, options.roomId]);
}

// Hook for user online status
export function useUserOnlineStatus(
  callback: (data: { userId: string; isOnline: boolean }) => void
) {
  const { isConnected } = useSocket();

  useEffect(() => {
    if (!isConnected) return;

    const id = socketManager.on("userStatusChange", callback);
    return () => socketManager.off(id);
  }, [isConnected, callback]);
}
