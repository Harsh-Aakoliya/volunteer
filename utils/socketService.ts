// utils/socketService.ts - Updated with better type handling
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/constants/api';

// Remove the /api prefix if needed
const SOCKET_URL = API_URL.replace('/api', '');

// Define event types
interface OnlineUsersEvent {
  roomId: string;
  onlineUsers: string[];
  totalMembers?: number;
}

// utils/socketService.ts - Update the RoomMembersEvent interface (continued)
interface RoomMembersEvent {
  roomId: string;
  members: Array<{
    userId: string;
    fullName: string | null;
    isAdmin: boolean;
    isOnline: boolean;
  }>;
}



// In utils/socketService.ts
interface NewMessageEvent {
  id: number;
  roomId: string; // This is a string from the socket
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

class SocketService {
  socket: Socket | null = null;
  
  // Initialize the socket connection
  connect(): Socket | null {
    if (!this.socket) {
      try {
        this.socket = io(SOCKET_URL);
        
        this.socket.on('connect', () => {
          console.log('Socket connected:', this.socket?.id);
        });
        
        this.socket.on('disconnect', () => {
          console.log('Socket disconnected');
        });
        
        this.socket.on('error', (error: any) => {
          console.error('Socket error:', error);
        });
      } catch (error) {
        console.error('Failed to connect to socket server:', error);
        return null;
      }
    }
    
    return this.socket;
  }
  
  // Join a chat room
  joinRoom(roomId: string, userId: string, userName: string): void {
    if (this.socket) {
      this.socket.emit('joinRoom', { roomId, userId, userName });
    }
  }
  
  // Leave a chat room
  leaveRoom(roomId: string, userId: string): void {
    if (this.socket) {
      this.socket.emit('leaveRoom', { roomId, userId });
    }
  }
  
  // Send a message to a room
  sendMessage(roomId: string, message: any, sender: { userId: string, userName: string }): void {
    if (this.socket) {
      this.socket.emit('sendMessage', { roomId, message, sender });
    }
  }
  
  // Listen for online users updates
  onOnlineUsers(callback: (data: OnlineUsersEvent) => void): void {
    if (this.socket) {
      this.socket.on('onlineUsers', callback);
    }
  }
  
  // Update the onRoomMembers method to handle the correct types
  onRoomMembers(callback: (data: RoomMembersEvent) => void): void {
    if (this.socket) {
      this.socket.on('roomMembers', callback);
    }
  }
  
  // Listen for new messages
  onNewMessage(callback: (data: NewMessageEvent) => void): void {
    if (this.socket) {
      this.socket.on('newMessage', callback);
    }
  }
  
  // Listen for user going offline
  onUserOffline(callback: (data: UserOfflineEvent) => void): void {
    if (this.socket) {
      this.socket.on('userOffline', callback);
    }
  }
  
  // Remove event listeners
  removeListeners(): void {
    if (this.socket) {
      this.socket.off('onlineUsers');
      this.socket.off('roomMembers');
      this.socket.off('newMessage');
      this.socket.off('userOffline');
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