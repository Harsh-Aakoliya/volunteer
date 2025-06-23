import axios from 'axios';
import { API_URL } from '../constants/api';
import Announcement from '@/app/create-announcement';

export const getPendingUsers = async () => {
  const response = await axios.get(`${API_URL}/api/users/pending-users`);
  console.log("at frontend getPendingUsers",response.data);
  return response.data;
};

export const approveUser = async (userId: string) => {
  const response = await axios.post(`${API_URL}/api/users/approve-user`, { userId });
  return response.data;
};

export const rejectUser = async (userId: string) => {
  const response = await axios.post(`${API_URL}/api/users/reject-user`, { userId });
  return response.data;
};


export const fetchAnnouncements = async () => {
  // console.log("trying to fetch announcements from frontend");
  const response = await axios.get(`${API_URL}/api/announcements`);
  // console.log("response from fetchAnnouncements",response.data);
  return response.data;
};

export const fetchAnnouncementsDebug = async () => {
  console.log("Fetching all announcements for debug");
  const response = await axios.get(`${API_URL}/api/announcements/debug`);
  console.log("Debug response:", response.data);
  return response.data;
};

export const createAnnouncement = async (title:any, body:any, authorId:any, status:any = 'published') => {
  const response = await axios.post(`${API_URL}/api/announcements`, { title, body, authorId, status });
  return response.data;
};

// Add this to your api/admin.js file
export const updateAnnouncement = async (id:any, title:any, body:any) => {
  const response = await axios.put(`${API_URL}/api/announcements/${id}`, { title, body });
  return response.data;
};

export const deleteAnnouncement = async (id:number)=>{
  const response = await axios.delete(`${API_URL}/api/announcements/${id}`);
  return response.data;
}

export const updateLikes = async (id:any, type:any) => {
  await axios.post(`${API_URL}/api/announcements/likes`, { id, type });
};

// New API functions for like and read functionality
export const toggleLike = async (id: number, userId: string) => {
  const response = await axios.post(`${API_URL}/api/announcements/${id}/toggle-like`, { userId });
  return response.data;
};

export const markAsRead = async (id: number, userId: string) => {
  const response = await axios.post(`${API_URL}/api/announcements/${id}/mark-read`, { userId });
  return response.data;
};

export const getLikedUsers = async (id: number) => {
  const response = await axios.get(`${API_URL}/api/announcements/${id}/liked-users`);
  return response.data;
};

export const getReadUsers = async (id: number) => {
  const response = await axios.get(`${API_URL}/api/announcements/${id}/read-users`);
  return response.data;
};

// New API functions for draft functionality
export const createDraft = async (authorId: string) => {
  const response = await axios.post(`${API_URL}/api/announcements/draft`, { authorId });
  return response.data;
};

export const updateDraft = async (id: number, title: string, body: string, authorId: string) => {
  const response = await axios.put(`${API_URL}/api/announcements/draft/${id}`, { title, body, authorId });
  return response.data;
};

export const publishDraft = async (id: number, title: string, body: string, authorId: string) => {
  const response = await axios.put(`${API_URL}/api/announcements/draft/${id}/publish`, { title, body, authorId });
  return response.data;
};

export const getDrafts = async (authorId: string) => {
  const response = await axios.get(`${API_URL}/api/announcements/drafts/${authorId}`);
  return response.data;
};

export const deleteDraft = async (id: number, authorId: string) => {
  console.log("deleting draft", id, authorId);
  const response = await axios.delete(`${API_URL}/api/announcements/draft/${id}`, { data: { authorId } });
  return response.data;
};

export const removeEmptyDraft = async (id: number, authorId: string) => {
  const response = await axios.delete(`${API_URL}/api/announcements/draft/${id}/empty`, { data: { authorId } });
  return response.data;
};
