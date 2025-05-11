// utils/socketService.ts
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/constants/api";

// Remove the /api prefix if needed
const SOCKET_URL = API_URL.replace("/api", "");

// Define event types
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
  createdAt: string;
  sender: {
    userId: string;
    userName: string;
  };
}

interface UserOfflineEvent {
  roomId: string;
  userId: string;
}

interface UnreadMessagesEvent {
  roomId: string;
  count: number;
  lastMessage: NewMessageEvent;
}

interface RoomUpdateEvent {
  roomId: string;
  lastMessage: NewMessageEvent;
  unreadCount: number;
}

interface LastMessageEvent {
  roomId: string;
  message: NewMessageEvent;
}

class SocketService {
  socket: Socket | null = null;

  // Initialize the socket connection
  connect(): Socket | null {
    if (!this.socket) {
      try {
        this.socket = io(SOCKET_URL);

        // Collapse
        this.socket.on("connect", () => {
          console.log("Socket connected:", this.socket?.id);
        });

        this.socket.on("disconnect", () => {
          console.log("Socket disconnected");
        });

        this.socket.on("error", (error: any) => {
          console.error("Socket error:", error);
        });
      } catch (error) {
        console.error("Failed to connect to socket server:", error);
        return null;
      }
    }

    return this.socket;
  }

  // Check if socket is connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Identify the user to the socket server
  identify(userId: string): void {
    if (this.socket) {
      this.socket.emit("identify", { userId });
    }
  }

  // Join a chat room
  joinRoom(roomId: string, userId: string, userName: string): void {
    if (this.socket) {
      this.socket.emit("joinRoom", { roomId, userId, userName });
    }
  }

  // Leave a chat room
  leaveRoom(roomId: string, userId: string): void {
    if (this.socket) {
      this.socket.emit("leaveRoom", { roomId, userId });
    }
  }

  // Send a message to a room
  // Send a message to a room
  sendMessage(
    roomId: string,
    message: any,
    sender: { userId: string; userName: string }
  ): void {
    if (this.socket) {
      console.log("Sending message via socket:", { roomId, message, sender });
      this.socket.emit("sendMessage", {
        roomId,
        message: {
          id: message.id,
          messageText: message.messageText,
          createdAt: message.createdAt,
        },
        sender,
      });
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

  // Listen for unread messages updates
  onUnreadMessages(callback: (data: UnreadMessagesEvent) => void): void {
    if (this.socket) {
      this.socket.on("unreadMessages", callback);
    }
  }

  // Listen for room updates
  onRoomUpdate(callback: (data: RoomUpdateEvent) => void): void {
    if (this.socket) {
      this.socket.on("roomUpdate", callback);
    }
  }

  // Listen for last message updates
  onLastMessage(callback: (data: LastMessageEvent) => void): void {
    if (this.socket) {
      this.socket.on("lastMessage", callback);
    }
  }

  // Listen for user going offline
  onUserOffline(callback: (data: UserOfflineEvent) => void): void {
    if (this.socket) {
      this.socket.on("userOffline", callback);
    }
  }

  // Listen for room created event
  onRoomCreated(callback: () => void): void {
    if (this.socket) {
      this.socket.on("room_created", callback);
    }
  }

  // Listen for user status change
  onUserStatusChange(
    callback: (data: { userId: string; isOnline: boolean }) => void
  ): void {
    if (this.socket) {
      this.socket.on("user_status_change", callback);
    }
  }

  // Remove event listeners
  removeListeners(): void {
    if (this.socket) {
      this.socket.off("onlineUsers");
      this.socket.off("roomMembers");
      this.socket.off("newMessage");
      this.socket.off("unreadMessages");
      this.socket.off("roomUpdate");
      this.socket.off("lastMessage");
      this.socket.off("userOffline");
      this.socket.off("room_created");
      this.socket.off("user_status_change");
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
