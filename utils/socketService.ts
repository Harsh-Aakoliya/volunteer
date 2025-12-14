// utils/socketService.ts
import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/constants/api";

// Function to get socket URL dynamically
const getSocketUrl = (): string => {
  const apiUrl = getApiUrl();
  const socketUrl = apiUrl.replace("/api", "");
  console.log("🔌 Socket URL:", socketUrl);
  return socketUrl;
};

// Define event types - only keep what's actually used
interface OnlineUsersEvent {
  roomId: string;
  onlineUsers: string[];
  totalMembers?: number;
}

interface RoomMembersEvent {
  roomId: string;
  members: Array<{
    userId: string;
    fullName: string | null;
    isAdmin: boolean;
    isOnline: boolean;
  }>;
}

interface NewMessageEvent {
  id: number;
  roomId: string;
  messageText: string;
  messageType: string;
  createdAt: string;
  mediaFilesId?: number;
  pollId?: number;
  tableId?: number;
  replyMessageId?: number;
  isForwarded?: boolean;
  sender: {
    userId: string;
    userName: string;
  };
}

interface LastMessageData {
  createdAt: string;
  id: number;
  mediaFilesId: number | null;
  messageText: string;
  messageType: string;
  pollId: number | null;
  replyMessageId: number | null;
  sender: {
    userId: string;
    userName: string;
  };
  tableId: number | null;
}

interface LastMessageResponse {
  lastMessageByRoom: {
    [roomId: string]: LastMessageData;
  };
}

interface UnreadCountsEvent {
  unreadCounts: {
    [roomId: string]: number;
  };
}

interface RoomUpdateEvent {
  roomId: string;
  lastMessage: LastMessageData;
  unreadCount: number;
}

interface MessagesDeletedEvent {
  roomId: string;
  messageIds: (string | number)[];
  deletedBy: string;
}

interface MessageEditedEvent {
  roomId: string;
  messageId: number;
  messageText: string;
  isEdited: boolean;
  editedAt: string;
  editedBy: string;
  editorName?: string;
  senderId: string;
  senderName: string;
}

class SocketService {
  socket: Socket | null = null;
  private connectionPromise: Promise<Socket | null> | null = null;

  connect(): Socket | null {
    if (this.socket && this.socket.connected) {
      console.log("✅ Socket already connected:", this.socket.id);
      return this.socket;
    }

    try {
      const socketUrl = getSocketUrl();
      if (!socketUrl || socketUrl === "") {
        console.error("❌ Socket URL is empty, cannot connect");
        return null;
      }

      console.log("🔌 Connecting to socket:", socketUrl);
      
      // Disconnect old socket if exists
      if (this.socket) {
        this.socket.disconnect();
      }

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true,
      });

      this.socket.on("connect", () => {
        console.log("✅ Socket connected successfully! ID:", this.socket?.id);
        console.log("🔗 Socket connected state:", this.socket?.connected);
      });

      this.socket.on("disconnect", (reason) => {
        console.log("❌ Socket disconnected:", reason);
      });

      this.socket.on("connect_error", (error: any) => {
        console.error("❌ Socket connection error:", error.message || error);
      });

      this.socket.on("error", (error: any) => {
        console.error("❌ Socket error:", error);
      });

      this.socket.on("reconnect", (attemptNumber) => {
        console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      });

      this.socket.on("reconnect_attempt", (attemptNumber) => {
        console.log("🔄 Socket reconnection attempt:", attemptNumber);
      });

      // Add debugging for all events
      this.socket.on("lastMessage", (data) => {
        console.log("🔔 Received lastMessage event:", data);
      });

      this.socket.on("newMessage", (data) => {
        console.log("📨 Received newMessage event:", data);
      });

      this.socket.on("unreadCounts", (data) => {
        console.log("📊 Received unreadCounts event:", data);
      });

      this.socket.on("roomUpdate", (data) => {
        console.log("🏠 Received roomUpdate event:", data);
      });

      // Test connection after a short delay
      setTimeout(() => {
        console.log("🧪 Testing socket connection status:");
        console.log("- Socket exists:", !!this.socket);
        console.log("- Socket connected:", this.socket?.connected);
        console.log("- Socket ID:", this.socket?.id);
      }, 2000);

    } catch (error) {
      console.error("❌ Failed to connect to socket server:", error);
      return null;
    }

    return this.socket;
  }

  // Check if socket is connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Ensure socket is connected
  private ensureConnection(): boolean {
    if (!this.socket || !this.socket.connected) {
      console.log("⚠️ Socket not connected, attempting to connect...");
      this.connect();
      return this.socket?.connected || false;
    }
    return true;
  }

  // Identify method
  identify(userId: string): void {
    if (this.ensureConnection()) {
      console.log("🔐 Identifying user:", userId);
      this.socket!.emit("identify", { userId });
    } else {
      console.error("❌ Cannot identify user: Socket not connected");
    }
  }

  // Set user online status (global)
  setUserOnline(userId: string): void {
    if (this.ensureConnection()) {
      console.log("✅ Setting user online:", userId);
      this.socket!.emit("userOnline", { userId });
    } else {
      console.error("❌ Cannot set user online: Socket not connected");
    }
  }

  // Set user offline status (global)
  setUserOffline(userId: string): void {
    if (this.ensureConnection()) {
      console.log("❌ Setting user offline:", userId);
      this.socket!.emit("userOffline", { userId });
    } else {
      console.error("❌ Cannot set user offline: Socket not connected");
    }
  }

  // Request room data (unread counts and last messages)
  requestRoomData(userId: string): void {
    if (this.ensureConnection()) {
      console.log("📋 Requesting room data for user:", userId);
      this.socket!.emit("requestRoomData", { userId });
    } else {
      console.error("❌ Cannot request room data: Socket not connected");
    }
  }

  // Join a chat room
  joinRoom(roomId: string, userId: string, userName: string): void {
    if (this.ensureConnection()) {
      console.log("🏠 Joining room:", { roomId, userId, userName });
      this.socket!.emit("joinRoom", { roomId, userId, userName });
    } else {
      console.error("❌ Cannot join room: Socket not connected");
    }
  }

  // Leave a chat room
  leaveRoom(roomId: string, userId: string): void {
    if (this.ensureConnection()) {
      console.log("🚪 Leaving room:", { roomId, userId });
      this.socket!.emit("leaveRoom", { roomId, userId });
    } else {
      console.error("❌ Cannot leave room: Socket not connected");
    }
  }

  // Notify server when user enters chat tab
  enterChatTab(userId: string): void {
    if (this.ensureConnection()) {
      console.log("📱 Entering chat tab:", userId);
      this.socket!.emit("enterChatTab", { userId });
    } else {
      console.error("❌ Cannot enter chat tab: Socket not connected");
    }
  }

  // Notify server when user leaves chat tab
  leaveChatTab(userId: string): void {
    if (this.ensureConnection()) {
      console.log("📱 Leaving chat tab:", userId);
      this.socket!.emit("leaveChatTab", { userId });
    } else {
      console.error("❌ Cannot leave chat tab: Socket not connected");
    }
  }

  // Send a message to a room
  sendMessage(
    roomId: string,
    message: any,
    sender: { userId: string; userName: string }
  ): void {
    if (this.ensureConnection()) {
      console.log("📤 Sending message via socket:", { roomId, message, sender });
      this.socket!.emit("sendMessage", {
        roomId,
        message: {
          id: message.id,
          messageText: message.messageText,
          createdAt: message.createdAt,
          messageType: message.messageType,
          mediaFilesId: message.mediaFilesId,
          pollId: message.pollId,
          tableId: message.tableId,
          replyMessageId: message.replyMessageId
        },
        sender,
      });
    } else {
      console.error("❌ Cannot send message: Socket not connected");
    }
  }

  // Listen for online users updates
  onOnlineUsers(callback: (data: OnlineUsersEvent) => void): void {
    if (this.socket) {
      this.socket.on("onlineUsers", callback);
    }
  }

  // Listen for room members updates
  onRoomMembers(callback: (data: RoomMembersEvent) => void): void {
    if (this.socket) {
      this.socket.on("roomMembers", callback);
    }
  }

  // Listen for new messages
  onNewMessage(callback: (data: NewMessageEvent) => void): void {
    if (this.socket) {
      this.socket.on("newMessage", callback);
    }
  }

  // Listen for last message updates
  onLastMessage(callback: (data: LastMessageResponse) => void): void {
    if (this.socket) {
      this.socket.on("lastMessage", callback);
    }
  }

  // Listen for unread counts updates
  onUnreadCounts(callback: (data: UnreadCountsEvent) => void): void {
    if (this.socket) {
      this.socket.on("unreadCounts", callback);
    }
  }

  // Listen for room updates (real-time)
  onRoomUpdate(callback: (data: RoomUpdateEvent) => void): void {
    if (this.socket) {
      this.socket.on("roomUpdate", callback);
    }
  }

  // Listen for messages deleted events
  onMessagesDeleted(callback: (data: MessagesDeletedEvent) => void): void {
    if (this.socket) {
      this.socket.on("messagesDeleted", callback);
    }
  }

  // Listen for message edited events
  onMessageEdited(callback: (data: MessageEditedEvent) => void): void {
    if (this.socket) {
      this.socket.on("messageEdited", callback);
    }
  }

  onUserOnlineStatusUpdate(callback: (data: { userId: string; isOnline: boolean }) => void): void {
    if (this.socket) {
      // Remove existing listener to prevent duplicates
      this.socket.off("userOnlineStatusUpdate");
      this.socket.on("userOnlineStatusUpdate", callback);
    }
  }

  // Auto-connect and set online (call this on app startup)
  async connectAndSetOnline(userId: string): Promise<Socket | null> {
    const socket = this.connect();
    if (socket) {
      // Wait for connection to be established
      return new Promise((resolve) => {
        if (socket.connected) {
          this.identify(userId);
          this.setUserOnline(userId);
          resolve(socket);
        } else {
          socket.once("connect", () => {
            this.identify(userId);
            this.setUserOnline(userId);
            resolve(socket);
          });

          // Timeout after 5 seconds
          setTimeout(() => {
            if (!socket.connected) {
              console.error("❌ Socket connection timeout");
              resolve(null);
            }
          }, 5000);
        }
      });
    }
    return null;
  }

  // Remove event listeners
  removeListeners(): void {
    if (this.socket) {
      this.socket.off("onlineUsers");
      this.socket.off("roomMembers");
      this.socket.off("newMessage");
      this.socket.off("lastMessage");
      this.socket.off("unreadCounts");
      this.socket.off("roomUpdate");
      this.socket.off("messagesDeleted");
      this.socket.off("messageEdited");
      this.socket.off("userOnlineStatusUpdate");
    }
  }

  getRoomOnlineUsers(roomId: string) {
    if (this.socket?.connected) {
      this.socket.emit('getRoomOnlineUsers', { roomId });
    }
  }

  // Wait until socket is connected or timeout
  async waitForConnection(timeout: number = 5000): Promise<boolean> {
    if (this.socket?.connected) {
      return true;
    }

    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkConnection = () => {
        if (this.socket?.connected) {
          resolve(true);
        } else if (Date.now() - startTime >= timeout) {
          resolve(false);
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  // Safely ensure user is marked online
  async setUserOnlineSafe(userId: string): Promise<boolean> {
    try {
      if (!this.socket?.connected) {
        this.connect();
      }

      const connected = await this.waitForConnection(5000);
      if (!connected) {
        console.error("❌ Could not connect to set user online");
        return false;
      }

      this.identify(userId);
      this.setUserOnline(userId);
      console.log("✅ User set online successfully:", userId);
      return true;
    } catch (error) {
      console.error("❌ Error setting user online:", error);
      return false;
    }
  }

  // Debug method to check socket status
  debug(): void {
    console.log("🔍 Socket Debug Info:");
    console.log("- Socket exists:", !!this.socket);
    console.log("- Socket connected:", this.socket?.connected);
    console.log("- Socket ID:", this.socket?.id);
    console.log("- Socket URL:", getSocketUrl());
    console.log("- API URL:", getApiUrl());
    
    if (this.socket) {
      console.log("- Socket transport:", this.socket.io.engine?.transport?.name);
      console.log("- Socket ready state:", this.socket.io.engine?.readyState);
    }
  }

  // Disconnect the socket
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Create a singleton instance
const socketService = new SocketService();
export default socketService;
