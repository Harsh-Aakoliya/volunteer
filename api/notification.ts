// api/notification.ts
import axios from "axios";
import { API_URL } from "../constants/api";
import { AuthStorage } from "@/utils/authStorage";

export const storeNotificationToken = async (userId: string, token: string, deviceInfo?: any) => {
  try {
    const authToken = await AuthStorage.getToken();
    if (!authToken) throw new Error('No authentication token');

    const response = await axios.post(`${API_URL}/api/notifications/store-token`, {
      userId,
      token,
      tokenType: 'fcm',
      deviceInfo
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error storing notification token:', error);
    throw error;
  }
};

export const deleteNotificationToken = async (userId: string) => {
  try {
    const authToken = await AuthStorage.getToken();
    if (!authToken) throw new Error('No authentication token');

    const response = await axios.post(`${API_URL}/api/notifications/delete-token`, {
      userId,
      tokenType: 'fcm'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    return response.data;
  } catch (error) {
    console.error('Error deleting notification token:', error);
    throw error;
  }
};
