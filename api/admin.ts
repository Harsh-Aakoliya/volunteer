import axios from 'axios';
import { API_URL } from '../constants/api';

export const getPendingUsers = async () => {
  const response = await axios.get(`${API_URL}/api/users/pending-users`);
  console.log("at frontend getPendingUsers",response.data);
  return response.data;
};

export const approveUser = async (mobileNumber: string) => {
  const password = Math.random().toString(36).slice(-8);
  console.log("password send to backend",password);
  const response = await axios.post(`${API_URL}/api/users/approve-user`, {
    mobileNumber,
    password,
  });
  return response.data;
};

export const fetchAnnouncements = async () => {
  const response = await axios.get(`${API_URL}/api/announcements`);
  return response.data;
};

export const createAnnouncement = async (title: string, body: string, authorId: string) => {
  const response = await axios.post(`${API_URL}/api/announcements`, { title, body, authorId });
  return response.data;
};

export const updateAnnouncement = async (id: number, title: string, body: string) => {
  const response = await axios.put(`${API_URL}/api/announcements/${id}`, { title, body });
  return response.data;
};

export const deleteAnnouncement = async (id: number) => {
  const response = await axios.delete(`${API_URL}/api/announcements/${id}`);
  return response.data;
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

export const getLikedUsers = async (id: number, userId: string) => {
  const response = await axios.get(`${API_URL}/api/announcements/${id}/liked-users?userId=${userId}`);
  return response.data;
};

export const getReadUsers = async (id: number, userId: string) => {
  const response = await axios.get(`${API_URL}/api/announcements/${id}/read-users?userId=${userId}`);
  return response.data;
};