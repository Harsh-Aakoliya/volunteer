// api/chat.ts
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import { ChatRoom, ChatUser } from '@/types/type';

export const fetchChatUsers = async () => {
  try {
    const token = await AuthStorage.getToken();
    console.log("Token is ",token);
    const response = await axios.get(`${API_URL}/api/chat/users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching chat users:', error);
    throw error;
  }
};

export const createChatRoom = async (roomData: ChatRoom, selectedUserIds: number[]) => {
  try {
    console.log("roomData",roomData,selectedUserIds);
    const token = await AuthStorage.getToken();
    const response = await axios.post(`${API_URL}/api/chat/rooms`, 
      { 
        ...roomData, 
        user_ids: selectedUserIds 
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating chat room:', error);
    throw error;
  }
};

export const fetchChatRooms = async () => {
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.get(`${API_URL}/api/chat/rooms`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    throw error;
  }
};