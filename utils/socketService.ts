// utils/socketService.ts
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/constants/api";
import { MediaFile } from "@/types/type";

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
  messageType:string;
  createdAt: string;
  mediaFilesId?: number;
  pollId?: number;
  tableId?:number;
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
  lastMessage: {
    id: number;
    messageText: string;
    createdAt: string;
    messageType:string;
    mediaFilesId?: number;
    pollId?: number;
    tableId?:number;
    sender: {
      userId: string;
      userName: string;
    };
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

interface RoomUpdateEvent {
  roomId: string;
  lastMessage: {
    id: number;
    messageText: string;
    messageType:string;
    createdAt: string;
    mediaFilesId?: number;
    pollId?: number;
    tableId?:number;
    sender: {
      userId: string;
      userName: string;
    };
  };
  unreadCount: number;
}

interface LastMessageEvent {
  roomId: string;
  message: {
    id: number;
    messageText: string;
    messageType:string;
    createdAt: string;
    mediaFilesId?: number;
    pollId?: number;
    tableId?:number;
    sender: {
      userId: string;
      userName: string;
    };
  };
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

  // Enhanced identify method
  identify(userId: string): void {
    if (this.socket && this.socket.connected) {
      console.log("🔐 Identifying user:", userId);
      this.socket.emit("identify", { userId });
    } else {
      // console.error("❌ Cannot identify - socket not connected");
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
          tableId:message.tableId
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

  // Enhanced lastMessage listener with debugging
  onLastMessage(callback: (data: LastMessageResponse) => void): void {
    if (this.socket) {
      // Remove existing listeners to prevent duplicates
      this.socket.off("lastMessage");
      
      this.socket.on("lastMessage", (data) => {
        console.log("📨 LastMessage received in onLastMessage:", data);
        console.log("📊 Data structure:", JSON.stringify(data, null, 2));
        
        if (data && data.lastMessageByRoom) {
          console.log("✅ Valid lastMessage data, calling callback");
          callback(data);
        } else {
          console.warn("⚠️ Invalid lastMessage data structure:", data);
        }
      });
    } else {
      console.error("❌ Socket not connected, cannot listen for lastMessage");
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


  // Add these methods to your socketService class

// Listen for unread message counts
onUnreadCounts(callback: (data: any) => void): void {
  if (this.socket) {
    this.socket.on("unreadCounts", callback);
  }
}

// Listen for online user counts
onOnlineCounts(callback: (data: any) => void): void {
  if (this.socket) {
    this.socket.on("onlineCounts", callback);
  }
}

// Listen for combined room statistics
onRoomStats(callback: (data: any) => void): void {
  if (this.socket) {
    this.socket.on("roomStats", callback);
  }
}

// Request current unread counts
requestUnreadCounts(): void {
  if (this.socket) {
    this.socket.emit("requestUnreadCounts");
  }
}

// Request current online counts
requestOnlineCounts(): void {
  if (this.socket) {
    this.socket.emit("requestOnlineCounts");
  }
}

// Mark messages as read for a specific room
markMessagesAsRead(roomId: string): void {
  if (this.socket) {
    this.socket.emit("markAsRead", { roomId });
  }
}
}

// Create a singleton instance
const socketService = new SocketService();
export default socketService;
