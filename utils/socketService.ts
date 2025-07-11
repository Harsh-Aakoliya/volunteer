// utils/socketService.ts
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/constants/api";

// Remove the /api prefix if needed
const SOCKET_URL = API_URL.replace("/api", "");

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

class SocketService {
  socket: Socket | null = null;

  connect(): Socket | null {
    if (!this.socket) {
      try {
        this.socket = io(SOCKET_URL);

        this.socket.on("connect", () => {
          console.log("Socket connected:", this.socket?.id);
        });

        this.socket.on("disconnect", () => {
          console.log("Socket disconnected");
        });

        this.socket.on("error", (error: any) => {
          console.error("Socket error:", error);
        });

        // Add debugging for lastMessage events
        this.socket.on("lastMessage", (data) => {
          console.log("🔔 Received lastMessage event:", data);
        });

      } catch (error) {
        console.error("Failed to connect to socket server:", error);
        return null;
      }
    } else {
      console.log("Socket already connected:", this.socket.id);
    }

    return this.socket;
  }

  // Check if socket is connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Identify method
  identify(userId: string): void {
    if (this.socket && this.socket.connected) {
      console.log("🔐 Identifying user:", userId);
      this.socket.emit("identify", { userId });
    }
  }

  // Request room data (unread counts and last messages)
  requestRoomData(userId: string): void {
    if (this.socket && this.socket.connected) {
      console.log("📋 Requesting room data for user:", userId);
      this.socket.emit("requestRoomData", { userId });
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
          messageType: message.messageType,
          mediaFilesId: message.mediaFilesId,
          pollId: message.pollId,
          tableId: message.tableId
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
