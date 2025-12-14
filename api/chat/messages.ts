import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";

export const getScheduledMessages = async (roomId: string) => {
  const token = await AuthStorage.getToken();
  const response = await axios.get(
    `${API_URL}/api/chat/rooms/${roomId}/scheduled-messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const getNewMessages = async (
  roomId: string,
  afterTimestamp?: string,
  limit: number = 50
) => {
  const token = await AuthStorage.getToken();
  const params: Record<string, string | number> = { limit };
  if (afterTimestamp) {
    params.afterTimestamp = afterTimestamp;
  }

  const response = await axios.get(
    `${API_URL}/api/chat/rooms/${roomId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params,
    }
  );
  return response.data.messages || [];
};
