// api/chat.ts
import axios from "axios";
import { API_URL } from "../constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { ChatRoom, ChatUser } from "@/types/type";

// Fetch all users for chat room creation
export const fetchChatUsers = async (): Promise<ChatUser[]> => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.get(`${API_URL}/api/chat/users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    // Map the response to match our frontend types
    return response.data.map((user: any) => ({
      userId: user.userId,
      fullName: user.fullName,
      mobileNumber: user.mobileNumber,
      role: user.role
    }));
  } catch (error) {
    console.error("Error fetching chat users:", error);
    throw error;
  }
};

// Create a new chat room
export const createChatRoom = async (
  roomData: { 
    roomName: string; 
    roomDescription?: string; 
    isGroup: boolean 
  }, 
  userIds: string[]
): Promise<ChatRoom> => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.post(
      `${API_URL}/api/chat/rooms`, 
      {
        roomName: roomData.roomName,
        roomDescription: roomData.roomDescription,
        isGroup: roomData.isGroup,
        userIds
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return {
      roomId: response.data.id,
      roomName: response.data.roomName,
      roomDescription: response.data.roomDescription,
      isGroup: response.data.isGroup
    };
  } catch (error) {
    console.error("Error creating chat room:", error);
    throw error;
  }
};

// api/chat.ts - Updated fetchChatRooms function
export const fetchChatRooms = async (): Promise<ChatRoom[]> => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.get(`${API_URL}/api/chat/rooms`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    // Map the response to match our frontend types
    return response.data.map((room: any) => ({
      roomId: room.id || room.roomId, // Use the id from the backend as roomId
      roomName: room.roomName,
      roomDescription: room.roomDescription,
      isGroup: room.isGroup,
      createdBy: room.createdBy,
      createdOn: room.createdOn,
      // Include user permissions if available
      isAdmin: room.isAdmin || false,
      canSendMessage: room.canSendMessage || false
    }));
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    throw error;
  }
};

// Get scheduled messages for a room
export const getScheduledMessages = async (roomId: string) => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}/scheduled-messages`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching scheduled messages:", error);
    throw error;
  }
};

// Get new messages after a timestamp (for sync)
export const getNewMessages = async (roomId: string, afterTimestamp?: string, limit: number = 50) => {
  try {
    const token = await AuthStorage.getToken();
    const params: any = { limit };
    if (afterTimestamp) {
      params.afterTimestamp = afterTimestamp;
    }
    
    const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}/messages`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params
    });
    return response.data.messages || [];
  } catch (error) {
    console.error("Error fetching new messages:", error);
    throw error;
  }
};

// Room Settings APIs

// Update group admins
export const updateGroupAdmins = async (roomId: string, adminUserIds: string[]) => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.put(
      `${API_URL}/api/chat/rooms/${roomId}/admins`,
      { adminUserIds },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating group admins:", error);
    throw error;
  }
};

// Update room members (add/remove)
export const updateRoomMembers = async (roomId: string, memberUserIds: string[]) => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.put(
      `${API_URL}/api/chat/rooms/${roomId}/members`,
      { memberUserIds },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating room members:", error);
    throw error;
  }
};

// Update messaging permissions
export const updateMessagingPermissions = async (roomId: string, allowedUserIds: string[]) => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.put(
      `${API_URL}/api/chat/rooms/${roomId}/messaging-permissions`,
      { allowedUserIds },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating messaging permissions:", error);
    throw error;
  }
};

// Rename room
export const renameRoom = async (roomId: string, roomName: string, roomDescription?: string) => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.put(
      `${API_URL}/api/chat/rooms/${roomId}/settings`,
      { roomName, roomDescription },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error renaming room:", error);
    throw error;
  }
};

// Leave room
export const leaveRoom = async (roomId: string) => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.post(
      `${API_URL}/api/chat/rooms/${roomId}/leave`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error leaving room:", error);
    throw error;
  }
};

// Delete room
export const deleteRoom = async (roomId: string) => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.delete(
      `${API_URL}/api/chat/rooms/${roomId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting room:", error);
    throw error;
  }
};