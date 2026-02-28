// api/chat/media.ts
import { AxiosRequestConfig } from "axios";
import { api, apiUrl } from "@/api/apiClient";

export const getMediaFiles = async (mediaFilesId: number) => {
  const response = await api.get(
    apiUrl(`/api/vm-media/media/${mediaFilesId}`),
    { headers: { "Content-Type": "application/json" } }
  );
  return response.data;
};

export const uploadMultipart = async (
  formData: FormData,
  onUploadProgress?: AxiosRequestConfig["onUploadProgress"],
  timeout: number = 300000
) => {
  const response = await api.post(
    apiUrl("/api/vm-media/upload-multipart"),
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      transformRequest: (data: any) => data,
      onUploadProgress,
      timeout,
    }
  );
  return response.data;
};

export const uploadBase64 = async (
  files: { name: string; mimeType: string; fileData: string }[]
) => {
  const response = await api.post(apiUrl("/api/vm-media/upload"), { files }, {
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
};

export const moveToChat = async (data: {
  tempFolderId: string;
  roomId: string;
  senderId: string;
  filesWithCaptions: any[];
  caption?: string;
}) => {
  const response = await api.post(apiUrl("/api/vm-media/move-to-chat"), data);
  return response.data;
};

export const moveToChatCamera = async (
  formData: FormData,
  timeout: number = 120000
) => {
  const response = await api.post(
    apiUrl("/api/vm-media/move-to-chat-camera"),
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      transformRequest: (data: any) => data,
      timeout,
    }
  );
  return response.data;
};
