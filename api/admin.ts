import axios from 'axios';
import { API_URL } from '../constants/api';
import { AuthStorage } from '@/utils/authStorage';

export const getPendingUsers = async () => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.get(`${API_URL}/api/users/pending-users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("at frontend getPendingUsers", response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching pending users:', error);
    throw error;
  }
};

export const approveUser = async (userId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.post(`${API_URL}/api/users/approve-user`, { userId }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error approving user:', error);
    throw error;
  }
};

export const rejectUser = async (userId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.post(`${API_URL}/api/users/reject-user`, { userId }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error rejecting user:', error);
    throw error;
  }
};

export const fetchAnnouncements = async () => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.get(`${API_URL}/api/announcements`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching announcements:', error);
    throw error;
  }
};

export const fetchAnnouncementsDebug = async () => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    console.log("Fetching all announcements for debug");
    const response = await axios.get(`${API_URL}/api/announcements/debug`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("Debug response:", response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching debug announcements:', error);
    throw error;
  }
};

export const createAnnouncement = async (title: any, body: any, authorId: any, status: any = 'published') => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.post(`${API_URL}/api/announcements`, 
      { title, body, authorId, status },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating announcement:', error);
    throw error;
  }
};

export const updateAnnouncement = async (id: any, title: any, body: any) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.put(`${API_URL}/api/announcements/${id}`, 
      { title, body },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating announcement:', error);
    throw error;
  }
};

export const deleteAnnouncement = async (id: number) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.delete(`${API_URL}/api/announcements/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting announcement:', error);
    throw error;
  }
};

export const updateLikes = async (id: any, type: any) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.post(`${API_URL}/api/announcements/${id}/likes`, 
      { type },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating likes:', error);
    throw error;
  }
};

export const toggleLike = async (id: number, userId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.post(`${API_URL}/api/announcements/${id}/toggle-like`, 
      { userId },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

export const markAsRead = async (id: number, userId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.post(`${API_URL}/api/announcements/${id}/mark-read`, 
      { userId },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error marking as read:', error);
    throw error;
  }
};

export const getLikedUsers = async (id: number) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.get(`${API_URL}/api/announcements/${id}/liked-users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching liked users:', error);
    throw error;
  }
};

export const getReadUsers = async (id: number) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.get(`${API_URL}/api/announcements/${id}/read-users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching read users:', error);
    throw error;
  }
};

export const createDraft = async (authorId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.post(`${API_URL}/api/drafts`, 
      { authorId },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating draft:', error);
    throw error;
  }
};

export const updateDraft = async (id: number, title: string, body: string, authorId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.put(`${API_URL}/api/drafts/${id}`, 
      { title, body, authorId },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating draft:', error);
    throw error;
  }
};

export const publishDraft = async (id: number, title: string, body: string, authorId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.post(`${API_URL}/api/drafts/${id}/publish`, 
      { title, body, authorId },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error publishing draft:', error);
    throw error;
  }
};

export const getDrafts = async (authorId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.get(`${API_URL}/api/drafts/${authorId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching drafts:', error);
    throw error;
  }
};

export const deleteDraft = async (id: number, authorId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.delete(`${API_URL}/api/drafts/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: { authorId }
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting draft:', error);
    throw error;
  }
};

export const removeEmptyDraft = async (id: number, authorId: string) => {
  try {
    const token = await AuthStorage.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }
    
    const response = await axios.delete(`${API_URL}/api/drafts/${id}/empty`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: { authorId }
    });
    return response.data;
  } catch (error) {
    console.error('Error removing empty draft:', error);
    throw error;
  }
};