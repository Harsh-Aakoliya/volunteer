import axios from 'axios';
import { API_URL } from '../constants/api';
import Announcement from '@/app/create-announcement';

export const getPendingUsers = async () => {
  const response = await axios.get(`${API_URL}/api/pending-users`);
  console.log("at frontend getPendingUsers",response.data);
  return response.data;
};

export const approveUser = async (mobileNumber: string) => {
  const password = Math.random().toString(36).slice(-8);
  console.log("password send to backend",password);
  const response = await axios.post(`${API_URL}/api/approve-user`, {
    mobileNumber,
    password,
  });
  return response.data;
};


export const fetchAnnouncements = async () => {
  console.log("trying to fetch announcements from frontend");
  const response = await axios.get(`${API_URL}/api/announcements`);
  console.log("response from fetchAnnouncements",response.data);
  return response.data;
};

export const createAnnouncement = async (title:any, body:any) => {
  const response = await axios.post(`${API_URL}/api/announcements`, { title, body });
  return response.data;
};

export const deleteAnnouncement = async (id:number)=>{
  const response = await axios.delete(`${API_URL}/api/announcement/${id}`);
  return response.data;
}

export const updateLikes = async (id:any, type:any) => {
  await axios.post(`${API_URL}/api/announcements/likes`, { id, type });
};
