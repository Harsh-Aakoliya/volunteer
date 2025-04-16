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
      mobileNumber: user.mobileNumber
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
      id: response.data.id,
      roomName: response.data.roomName,
      roomDescription: response.data.roomDescription,
      isGroup: response.data.isGroup
    };
  } catch (error) {
    console.error("Error creating chat room:", error);
    throw error;
  }
};

// Fetch all chat rooms for the current user
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
      id: room.id,
      roomName: room.roomName,
      roomDescription: room.roomDescription,
      isGroup: room.isGroup
    }));
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    throw error;
  }
};