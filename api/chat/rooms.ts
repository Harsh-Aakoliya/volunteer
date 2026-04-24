// api/chat/rooms.ts
import { api, apiUrl } from "@/api/apiClient";
import { ChatRoom, ChatUser, Community } from "@/types/type";

export const fetchChatUsers = async (): Promise<ChatUser[]> => {
  const response = await api.get(apiUrl("/api/chat/users"));
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
  const response = await api.post(apiUrl("/api/chat/rooms"), {
    roomName: roomData.roomName,
    roomDescription: roomData.roomDescription,
    isGroup: roomData.isGroup,
    userIds,
  });
  return {
    roomId: response.data.id,
    roomName: response.data.roomName,
    roomDescription: response.data.roomDescription,
    isGroup: response.data.isGroup,
  };
};

export const fetchChatRooms = async (): Promise<ChatRoom[]> => {
  const response = await api.get(apiUrl("/api/chat/rooms"));
  return response.data.map((room: any) => ({
    roomId: room.id || room.roomId,
    roomName: room.roomName,
    roomDescription: room.roomDescription,
    isGroup: room.isGroup,
    createdBy: room.createdBy,
    createdOn: room.createdOn,
    isAdmin: room.isAdmin || false,
    canSendMessage: room.canSendMessage || false,
    lastMessage: room.lastMessage || null,
    unreadCount: room.unreadCount || 0,
    // "-1" (or unset) means the room is not part of any community
    communityId:
      room.communityId !== undefined && room.communityId !== null
        ? String(room.communityId)
        : "-1",
  }));
};

// Fetch communities the authenticated user can see (derived from their rooms).
// There are no create/update/delete endpoints — those are done manually.
export const fetchCommunities = async (): Promise<Community[]> => {
  const response = await api.get(apiUrl("/api/chat/communities"));
  return response.data.map((c: any) => ({
    communityId: String(c.communityId),
    communityName: c.communityName,
    communityDescription: c.communityDescription ?? null,
  }));
};

export const getRoomDetails = async (
  roomId: string,
  userId?: string
) => {
  const headers: Record<string, string> = {};
  if (userId) headers.userId = userId;
  const response = await api.get(apiUrl(`/api/chat/rooms/${roomId}`), {
    headers,
  });
  return response.data;
};

export const updateGroupAdmins = async (
  roomId: string,
  adminUserIds: string[]
) => {
  const response = await api.put(
    apiUrl(`/api/chat/rooms/${roomId}/admins`),
    { adminUserIds }
  );
  return response.data;
};

export const updateRoomMembers = async (
  roomId: string,
  memberUserIds: string[]
) => {
  const response = await api.put(
    apiUrl(`/api/chat/rooms/${roomId}/members`),
    { memberUserIds }
  );
  return response.data;
};

export const updateMessagingPermissions = async (
  roomId: string,
  allowedUserIds: string[]
) => {
  const response = await api.put(
    apiUrl(`/api/chat/rooms/${roomId}/messaging-permissions`),
    { allowedUserIds }
  );
  return response.data;
};

export const renameRoom = async (
  roomId: string,
  roomName: string,
  roomDescription?: string
) => {
  const response = await api.put(
    apiUrl(`/api/chat/rooms/${roomId}/settings`),
    { roomName, roomDescription }
  );
  return response.data;
};

export const leaveRoom = async (roomId: string) => {
  const response = await api.post(
    apiUrl(`/api/chat/rooms/${roomId}/leave`),
    {}
  );
  return response.data;
};

export const deleteRoom = async (roomId: string) => {
  const response = await api.delete(apiUrl(`/api/chat/rooms/${roomId}`));
  return response.data;
};
