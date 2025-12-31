// utils/socketManager.ts
// Clean, robust Socket Manager for real-time chat functionality

import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/constants/api";
import { AppState, AppStateStatus, Platform } from "react-native";

// ==================== TYPES ====================

export interface SocketUser {
  id: string;
  name: string;
}

export interface LastMessage {
  id: number;
  messageText: string;
  messageType: string;
  createdAt: string;
  roomId: string;
  sender: {
    userId: string;
    userName: string;
  };
  mediaFilesId?: number | null;
  pollId?: number | null;
  tableId?: number | null;
}

export interface ChatMessage {
  id: number | string;
  roomId: number | string;
  senderId: string;
  senderName: string;
  messageText: string;
  messageType: string;
  createdAt: string;
  mediaFilesId?: number;
  pollId?: number;
  tableId?: number;
  replyMessageId?: number;
  replySenderName?: string;
  replyMessageText?: string;
  isEdited?: boolean;
  editedAt?: string;
}

export interface RoomUpdate {
  roomId: string;
  lastMessage?: LastMessage;
  unreadCount?: number;
}

export interface OnlineUsersUpdate {
  roomId: string;
  users: string[];
  count: number;
}

export interface MemberInfo {
  userId: string;
  fullName: string | null;
  isAdmin: boolean;
  isOnline: boolean;
}

export interface MessageEditedEvent {
  roomId: string;
  messageId: number;
  messageText: string;
  isEdited: boolean;
  editedAt: string;
}

export interface MessagesDeletedEvent {
  roomId: string;
  messageIds: (number | string)[];
}

// Callback types for subscriptions
type EventCallback<T = any> = (data: T) => void;

interface EventSubscription {
  id: number;
  callback: EventCallback;
}

// Find and UPDATE the MessageEditedEvent interface:
export interface MessageEditedEvent {
  roomId: string;
  messageId: number;
  messageText: string;
  isEdited: boolean;
  editedAt: string;
  isLastMessage?: boolean;  // NEW
}

// UPDATE MessagesDeletedEvent interface:
export interface MessagesDeletedEvent {
  roomId: string;
  messageIds: (number | string)[];
  newLastMessage?: LastMessage;  // NEW
  wasLastMessageDeleted?: boolean;  // NEW
}

// ==================== SOCKET MANAGER ====================

class SocketManager {
  private static instance: SocketManager;
  
  private socket: Socket | null = null;
  private user: SocketUser | null = null;
  private currentRoomId: string | null = null;
  
  // Connection state
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // App state
  private appStateSubscription: any = null;
  private isAppActive = true;
  
  // Event subscriptions
  private subscriptions = new Map<string, EventSubscription[]>();
  private subscriptionCounter = 0;
  
  // Throttling
  private lastRoomDataRequest = 0;
  private readonly THROTTLE_MS = 2000;

  private constructor() {}

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  // ==================== CONNECTION ====================

  private getSocketUrl(): string {
    const apiUrl = getApiUrl();
    return apiUrl.replace("/api", "");
  }

  async connect(user: SocketUser): Promise<boolean> {
    // Already connected with same user
    if (this.socket?.connected && this.user?.id === user.id) {
      return true;
    }

    // Already connecting
    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkInterval);
            resolve(this.socket?.connected || false);
          }
        }, 100);
      });
    }

    this.isConnecting = true;
    this.user = user;

    return new Promise((resolve) => {
      try {
        // Disconnect existing socket
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }

        const url = this.getSocketUrl();
        console.log("🔌 [Socket] Connecting to:", url);

        this.socket = io(url, {
          transports: ["websocket", "polling"],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        this.socket.on("connect", () => {
          console.log("✅ [Socket] Connected:", this.socket?.id);
          this.isConnecting = false;
          this.identifyUser();
          this.emit("connectionChange", { connected: true });
          resolve(true);
        });

        this.socket.on("disconnect", (reason) => {
          console.log("❌ [Socket] Disconnected:", reason);
          this.emit("connectionChange", { connected: false });
        });

        this.socket.on("connect_error", (error) => {
          console.error("❌ [Socket] Connection error:", error.message);
        });

        this.socket.on("reconnect", () => {
          console.log("🔄 [Socket] Reconnected");
          this.identifyUser();
          this.emit("connectionChange", { connected: true });
        });

        // Set up event listeners
        this.setupSocketListeners();

        // Connection timeout
        setTimeout(() => {
          if (this.isConnecting) {
            console.error("❌ [Socket] Connection timeout");
            this.isConnecting = false;
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        console.error("❌ [Socket] Failed to connect:", error);
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      if (this.user) {
        this.socket.emit("userOffline", { userId: this.user.id });
      }
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.user = null;
    this.currentRoomId = null;
    this.isConnecting = false;
    this.clearReconnectTimer();
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getUser(): SocketUser | null {
    return this.user;
  }

  // ==================== SOCKET LISTENERS ====================

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Last messages for rooms
    this.socket.on("lastMessage", (data: { lastMessageByRoom: Record<string, LastMessage> }) => {
      this.emit("lastMessages", data.lastMessageByRoom);
    });

    // Unread counts for rooms
    this.socket.on("unreadCounts", (data: { unreadCounts: Record<string, number> }) => {
      this.emit("unreadCounts", data.unreadCounts);
    });

    // Room update (new message, unread change)
    this.socket.on("roomUpdate", (data: RoomUpdate) => {
      this.emit("roomUpdate", data);
    });

    // New message in current room
    this.socket.on("newMessage", (data: any) => {
      const message: ChatMessage = {
        id: data.id,
        roomId: data.roomId,
        senderId: data.sender?.userId || data.senderId,
        senderName: data.sender?.userName || data.senderName,
        messageText: data.messageText,
        messageType: data.messageType || "text",
        createdAt: data.createdAt,
        mediaFilesId: data.mediaFilesId,
        pollId: data.pollId,
        tableId: data.tableId,
        replyMessageId: data.replyMessageId,
        replySenderName: data.replySenderName,
        replyMessageText: data.replyMessageText,
      };
      this.emit("newMessage", message);
    });

    // Message edited
    this.socket.on("messageEdited", (data: MessageEditedEvent) => {
      this.emit("messageEdited", data);
    });

    // Messages deleted
    this.socket.on("messagesDeleted", (data: MessagesDeletedEvent) => {
      this.emit("messagesDeleted", data);
    });

    // Online users for a room
    this.socket.on("onlineUsers", (data: any) => {
      this.emit("onlineUsers", {
        roomId: data.roomId,
        users: data.onlineUsers || [],
        count: data.onlineCount || 0,
      });
    });

    // Room members with online status
    this.socket.on("roomMembers", (data: { roomId: string; members: MemberInfo[] }) => {
      this.emit("roomMembers", data);
    });

    // User online/offline status change
    this.socket.on("userOnlineStatusUpdate", (data: { userId: string; isOnline: boolean }) => {
      this.emit("userStatusChange", data);
    });

    // Room online users (response to getRoomOnlineUsers)
    this.socket.on("roomOnlineUsers", (data: { roomId: string; onlineUsers: string[] }) => {
      this.emit("onlineUsers", {
        roomId: data.roomId,
        users: data.onlineUsers,
        count: data.onlineUsers.length,
      });
    });
  }

  // ==================== USER ACTIONS ====================

  private identifyUser(): void {
    if (!this.socket?.connected || !this.user) return;
    
    console.log("🔐 [Socket] Identifying user:", this.user.id);
    this.socket.emit("identify", { userId: this.user.id });
    this.socket.emit("userOnline", { userId: this.user.id });
  }

  setUserOnline(): void {
    if (!this.socket?.connected || !this.user) return;
    this.socket.emit("userOnline", { userId: this.user.id });
  }

  setUserOffline(): void {
    if (!this.socket?.connected || !this.user) return;
    this.socket.emit("userOffline", { userId: this.user.id });
  }

  // ==================== ROOM ACTIONS ====================

  requestRoomData(): void {
    if (!this.socket?.connected || !this.user) return;

    // Throttle requests
    const now = Date.now();
    if (now - this.lastRoomDataRequest < this.THROTTLE_MS) {
      return;
    }
    this.lastRoomDataRequest = now;

    console.log("📋 [Socket] Requesting room data");
    this.socket.emit("requestRoomData", { userId: this.user.id });
  }

  joinRoom(roomId: string): void {
    if (!this.socket?.connected || !this.user) return;

    // Leave current room first
    if (this.currentRoomId && this.currentRoomId !== roomId) {
      this.leaveRoom(this.currentRoomId);
    }

    console.log("🏠 [Socket] Joining room:", roomId);
    this.currentRoomId = roomId;
    this.socket.emit("joinRoom", {
      roomId,
      userId: this.user.id,
      userName: this.user.name,
    });
  }

  leaveRoom(roomId: string): void {
    if (!this.socket?.connected || !this.user) return;

    console.log("🚪 [Socket] Leaving room:", roomId);
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
    }
    this.socket.emit("leaveRoom", {
      roomId,
      userId: this.user.id,
    });
  }

  getCurrentRoom(): string | null {
    return this.currentRoomId;
  }

  requestOnlineUsers(roomId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit("getRoomOnlineUsers", { roomId });
  }

  // ==================== MESSAGE ACTIONS ====================

  sendMessage(roomId: string, message: Partial<ChatMessage>): void {
    if (!this.socket?.connected || !this.user) {
      console.error("❌ [Socket] Cannot send message: not connected");
      return;
    }

    console.log("📤 [Socket] Sending message to room:", roomId);
    this.socket.emit("sendMessage", {
      roomId,
      message: {
        id: message.id,
        messageText: message.messageText,
        messageType: message.messageType || "text",
        createdAt: message.createdAt,
        mediaFilesId: message.mediaFilesId,
        pollId: message.pollId,
        tableId: message.tableId,
        replyMessageId: message.replyMessageId,
      },
      sender: {
        userId: this.user.id,
        userName: this.user.name,
      },
    });
  }

  // ==================== APP STATE ====================

  startAppStateListener(): void {
    if (Platform.OS === "web" || this.appStateSubscription) return;

    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange.bind(this)
    );
    console.log("📱 [Socket] App state listener started");
  }

  stopAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private handleAppStateChange(state: AppStateStatus): void {
    const wasActive = this.isAppActive;
    this.isAppActive = state === "active";

    if (!wasActive && this.isAppActive) {
      // App came to foreground
      console.log("✅ [Socket] App active");
      if (!this.socket?.connected && this.user) {
        this.connect(this.user);
      } else {
        this.setUserOnline();
        this.requestRoomData();
      }
    } else if (wasActive && !this.isAppActive) {
      // App went to background
      console.log("💤 [Socket] App background");
      this.setUserOffline();
    }
  }

  // ==================== EVENT SUBSCRIPTIONS ====================

  on<T = any>(event: string, callback: EventCallback<T>): number {
    const id = ++this.subscriptionCounter;
    
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, []);
    }
    
    this.subscriptions.get(event)!.push({ id, callback });
    return id;
  }

  off(subscriptionId: number): void {
    for (const [event, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(event);
        }
        return;
      }
    }
  }

  private emit(event: string, data: any): void {
    const subs = this.subscriptions.get(event);
    if (!subs) return;

    for (const sub of subs) {
      try {
        sub.callback(data);
      } catch (error) {
        console.error(`❌ [Socket] Error in ${event} callback:`, error);
      }
    }
  }

  // ==================== UTILITIES ====================

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  reset(): void {
    this.disconnect();
    this.subscriptions.clear();
    this.subscriptionCounter = 0;
  }

  debug(): void {
    console.log("🔍 [Socket] Debug:");
    console.log("  Connected:", this.isConnected());
    console.log("  Socket ID:", this.socket?.id);
    console.log("  User:", this.user);
    console.log("  Current Room:", this.currentRoomId);
    console.log("  Subscriptions:", this.subscriptions.size);
  }
}

// Export singleton
const socketManager = SocketManager.getInstance();
export default socketManager;
