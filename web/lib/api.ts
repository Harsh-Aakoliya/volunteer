import axios from 'axios';

// API base URL - can be configured via environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add token
api.interceptors.request.use(
  (config) => {
    // Only add token on client side
    if (typeof window !== 'undefined') {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          const token = parsed?.state?.token;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      } catch (error) {
        console.error('Error reading auth storage:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface LoginCredentials {
  mobileNumber?: string;
  sevakId?: string;
  password: string;
}

export interface RegisterData {
  mobileNumber: string;
  userId: string;
  fullName: string;
}

export interface WebPermissions {
  accessLevel: 'master' | 'admin';
  canCreateAnnouncement: boolean;
  canCreateChatGroup: boolean;
  canEditUserProfile: boolean;
  canEditDepartments: boolean;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  userId?: string;
  isAdmin?: boolean;
  message?: string;
  webPermissions?: WebPermissions;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

export interface User {
  userId: string;
  mobileNumber: string;
  isAdmin: boolean;
  fullName?: string;
  departments?: string[];
  isApproved?: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  authorId: string;
  authorName?: string;
  authorDepartments?: string[];
  authorAccessLevel?: 'master' | 'admin';
  departmentTag?: string[];
  departmentTags?: string[];
  status: 'draft' | 'published' | 'scheduled';
  createdAt: string;
  updatedAt?: string;
  scheduledAt?: string;
  hasCoverImage?: boolean;
  readBy?: Array<{ userId: string; fullName?: string; readAt: string }>;
  likedBy?: Array<{ userId: string; fullName?: string; likedAt: string }>;
}

// Auth API functions
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    console.log("login response",response.data);
    return response.data;
  },

  register: async (data: RegisterData): Promise<RegisterResponse> => {
    const response = await api.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  getUserProfile: async (userId: string, token: string): Promise<User> => {
    const response = await api.get<User>(`/users/${userId}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },
};

// Announcement API functions
export const announcementApi = {
  fetchUserAnnouncements: async (): Promise<{ announcements: Announcement[]; departments: string[] }> => {
    const response = await api.get<{ announcements: Announcement[]; departments: string[] }>('/announcements/user-announcements');
    return response.data;
  },

  getAnnouncementDetails: async (id: number): Promise<Announcement> => {
    const response = await api.get<Announcement>(`/announcements/${id}/details`);
    return response.data;
  },

  createDraft: async (authorId: string, departmentTags: string[] = []) => {
    const response = await api.post('/announcements/draft', {
      authorId,
      departmentTags,
    });
    return response.data;
  },

  updateDraft: async (
    id: number,
    title: string,
    body: string,
    authorId: string,
    departmentTags: string[] = []
  ) => {
    const response = await api.put(`/announcements/draft/${id}`, {
      title,
      body,
      authorId,
      departmentTags,
    });
    return response.data;
  },

  publishDraft: async (
    id: number,
    title: string,
    body: string,
    authorId: string,
    departmentTags: string[] = []
  ) => {
    const response = await api.put(`/announcements/draft/${id}/publish`, {
      title,
      body,
      authorId,
      departmentTags,
    });
    return response.data;
  },

  scheduleDraft: async (
    id: number,
    title: string,
    body: string,
    authorId: string,
    departmentTags: string[] = [],
    scheduledAt: string
  ) => {
    const response = await api.put(`/announcements/draft/${id}/schedule`, {
      title,
      body,
      authorId,
      departmentTags,
      scheduledAt,
    });
    return response.data;
  },

  rescheduleAnnouncement: async (
    id: number,
    title: string,
    body: string,
    authorId: string,
    departmentTags: string[] = [],
    scheduledAt: string
  ) => {
    const response = await api.put(`/announcements/scheduled/${id}/reschedule`, {
      title,
      body,
      authorId,
      departmentTags,
      scheduledAt,
    });
    return response.data;
  },

  updateAnnouncement: async (
    id: number,
    title: string,
    body: string,
    departmentTags: string[] = []
  ) => {
    const response = await api.put(`/announcements/${id}`, {
      title,
      body,
      departmentTags,
    });
    return response.data;
  },

  deleteAnnouncement: async (id: number) => {
    const response = await api.delete(`/announcements/${id}`);
    return response.data;
  },

  deleteDraft: async (id: number, authorId: string) => {
    const response = await api.delete(`/announcements/draft/${id}`, {
      data: { authorId },
    });
    return response.data;
  },

  toggleLike: async (id: number, userId: string) => {
    const response = await api.post(`/announcements/${id}/toggle-like`, {
      userId,
    });
    return response.data;
  },

  markAsRead: async (id: number, userId: string) => {
    const response = await api.post(`/announcements/${id}/mark-read`, {
      userId,
    });
    return response.data;
  },

  getAllDepartments: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/announcements/departments');
    return response.data;
  },

  getAnnouncementMedia: async (id: number) => {
    const response = await api.get(`/announcements/${id}/media`);
    return response.data;
  },

  uploadMedia: async (id: number, files: File[]): Promise<{ success: boolean; uploadedFiles: any[]; message: string }> => {
    // Convert File objects to base64 format expected by backend
    const filesWithData = await Promise.all(
      files.map(async (file) => {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        return {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileData: base64,
        };
      })
    );

    const response = await api.post(`/announcements/${id}/media/upload`, {
      files: filesWithData,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },

  deleteMedia: async (id: number, fileName: string) => {
    const response = await api.delete(`/announcements/${id}/media/${fileName}`);
    return response.data;
  },
};

// Department interfaces
export interface Department {
  departmentId: string;
  departmentName: string;
  createdBy: string;
  createdAt: string;
  userList?: string[];
  hodList?: string[];
  createdByName?: string;
  hodNames?: string[];
}

export interface DepartmentUser {
  userId: string;
  fullName: string;
  mobileNumber: string;
  xetra?: string;
  mandal?: string;
  isAdmin?: boolean;
  departments?: string[];
}

// User interfaces
export interface UserProfile {
  userId: string;
  mobileNumber: string;
  fullName: string;
  isAdmin: boolean;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  education?: string;
  occupation?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  xetra?: string;
  mandal?: string;
  departments?: string[];
  departmentIds?: string[];
  subdepartments?: string[];
  profilePicture?: string;
  isApproved?: boolean;
  whatsappNumber?: string;
  emergencyContact?: string;
  email?: string;
}

export interface SearchFiltersResponse {
  departments: Array<{ departmentId: string; departmentName: string }>;
  subdepartments: Array<{ subdepartmentId: string; subdepartmentName: string; departmentId: string }>;
  userRole: { isKaryalay: boolean; isHOD: boolean };
}

export interface UpdateUserData {
  fullName: string;
  mobileNumber: string;
  isAdmin?: boolean;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  education?: string;
  whatsappNumber?: string;
  emergencyContact?: string;
  email?: string;
  address?: string;
  departmentIds?: string[];
}

// Department API functions
export const departmentApi = {
  fetchMyDepartments: async (): Promise<Department[]> => {
    const response = await api.get<Department[]>('/departments/my-departments');
    return response.data;
  },

  fetchDepartmentById: async (departmentId: string): Promise<Department> => {
    const response = await api.get<Department>(`/departments/${departmentId}`);
    return response.data;
  },

  fetchAllUsers: async (): Promise<DepartmentUser[]> => {
    const response = await api.get<DepartmentUser[]>('/departments/users');
    return response.data;
  },
};

// User API functions
export const userApi = {
  getUserProfileById: async (userId: string): Promise<UserProfile> => {
    const response = await api.get<UserProfile>(`/users/${userId}/profile`);
    return response.data;
  },

  fetchSabhaAttendanceForUser: async (userId: string) => {
    const response = await api.get(`/users/${userId}/attendance`);
    return response.data;
  },

  updateUserWithSubdepartments: async (userId: string, userData: UpdateUserData): Promise<UserProfile> => {
    const response = await api.put<UserProfile>(`/users/update-with-subdepartments/${userId}`, userData);
    return response.data;
  },

  getSearchFilters: async (): Promise<SearchFiltersResponse> => {
    const response = await api.get<SearchFiltersResponse>('/users/search-filters');
    return response.data;
  },
};

export default api;
