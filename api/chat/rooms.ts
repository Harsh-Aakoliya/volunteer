import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { ChatRoom, ChatUser } from "@/types/type";

export const fetchChatUsers = async (): Promise<ChatUser[]> => {
  const token = await AuthStorage.getToken();
  const response = await axios.get(`${API_URL}/api/chat/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data.map((user: any) => ({
    userId: user.userId,
    fullName: user.fullName,
    mobileNumber: user.mobileNumber,
    role: user.role,
  }));
};

export const createChatRoom = async (
  roomData: {
    roomName: string;
    roomDescription?: string;
    isGroup: boolean;
  },
  userIds: string[]
): Promise<ChatRoom> => {
  const token = await AuthStorage.getToken();
  const response = await axios.post(
    `${API_URL}/api/chat/rooms`,
    {
      roomName: roomData.roomName,
      roomDescription: roomData.roomDescription,
      isGroup: roomData.isGroup,
      userIds,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return {
    roomId: response.data.id,
    roomName: response.data.roomName,
    roomDescription: response.data.roomDescription,
    isGroup: response.data.isGroup,
  };
};

export const fetchChatRooms = async (): Promise<ChatRoom[]> => {
  const token = await AuthStorage.getToken();
  const response = await axios.get(`${API_URL}/api/chat/rooms`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data.map((room: any) => ({
    roomId: room.id || room.roomId,
    roomName: room.roomName,
    roomDescription: room.roomDescription,
    isGroup: room.isGroup,
    createdBy: room.createdBy,
    createdOn: room.createdOn,
    isAdmin: room.isAdmin || false,
    canSendMessage: room.canSendMessage || false,
  }));
};

export const updateGroupAdmins = async (
  roomId: string,
  adminUserIds: string[]
) => {
  const token = await AuthStorage.getToken();
  const response = await axios.put(
    `${API_URL}/api/chat/rooms/${roomId}/admins`,
    { adminUserIds },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const updateRoomMembers = async (
  roomId: string,
  memberUserIds: string[]
) => {
  const token = await AuthStorage.getToken();
  const response = await axios.put(
    `${API_URL}/api/chat/rooms/${roomId}/members`,
    { memberUserIds },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const updateMessagingPermissions = async (
  roomId: string,
  allowedUserIds: string[]
) => {
  const token = await AuthStorage.getToken();
  const response = await axios.put(
    `${API_URL}/api/chat/rooms/${roomId}/messaging-permissions`,
    { allowedUserIds },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const renameRoom = async (
  roomId: string,
  roomName: string,
  roomDescription?: string
) => {
  const token = await AuthStorage.getToken();
  const response = await axios.put(
    `${API_URL}/api/chat/rooms/${roomId}/settings`,
    { roomName, roomDescription },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const leaveRoom = async (roomId: string) => {
  const token = await AuthStorage.getToken();
  const response = await axios.post(
    `${API_URL}/api/chat/rooms/${roomId}/leave`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const deleteRoom = async (roomId: string) => {
  const token = await AuthStorage.getToken();
  const response = await axios.delete(`${API_URL}/api/chat/rooms/${roomId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};
