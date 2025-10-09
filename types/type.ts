// types/type.ts
import { TextInputProps, TouchableOpacityProps } from "react-native";
import { Ionicons } from '@expo/vector-icons';

// UI Component Props
export interface ButtonProps extends TouchableOpacityProps {
    title: string;
    bgVariant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
    textVariant?: 'primary' | 'secondary' | 'danger' | 'success' | 'default';
    IconLeft?: () => React.ReactNode;
    IconRight?: () => React.ReactNode;
    className?: string;
    loading?: boolean;
}

export interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerClassName?: string;
    className?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    touched?: boolean;
}

export interface StatCardProps {
    title: string;
    value: number;
    icon: keyof typeof Ionicons.glyphMap;
    color?: string;
}

// User-related Types
export interface User {
  userId: string;
  mobileNumber: string;
  isAdmin: boolean;
  fullName?: string;
  xetra?: string;
  mandal?: string;
  role?: string;
  departments?: string[];
  departmentIds?: string[];
  subdepartmentIds?: string[];
  totalSabha?: number;
  presentCount?: number;
  absentCount?: number;
  isApproved?: boolean;
}

// Department-related Types
export interface Department {
  departmentId: string;
  departmentName: string;
  createdBy: string;
  createdAt: string;
  userList: string[];
  hodList: string[];
  createdByName?: string;
  hodNames?: string[];
  hodCount?: number;
  userCount?: number;
}

export interface Subdepartment {
  subdepartmentId: string;
  subdepartmentName: string;
  departmentId: string;
  createdBy: string;
  createdAt: string;
  userList: string[];
  createdByName?: string;
}

export interface DepartmentUser {
  userId: string;
  fullName: string;
  mobileNumber: string;
  isAdmin: boolean;
  departments?: string[];
  departmentIds?: string[];
  subdepartmentIds?: string[];
  subdepartments?: Array<{id: string, name: string}>;
  xetra?: string;
  mandal?: string;
  role?: string;
}

export interface CreateDepartmentRequest {
  departmentName: string;
  userList: string[];
  hodList: string[];
}

export interface UpdateDepartmentRequest {
  departmentId: string;
  userList?: string[];
  departmentName?: string;
  hodList?: string[];
}

export interface CreateSubdepartmentRequest {
  subdepartmentName: string;
  userList: string[];
}

export interface UpdateSubdepartmentRequest {
  subdepartmentName?: string;
  userList?: string[];
}

export interface SearchUsersRequest {
  searchQuery?: string;
  departmentIds?: string[];
  subdepartmentIds?: string[];
  page?: number;
  limit?: number;
}

export interface SearchUsersResponse {
  users: DepartmentUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SearchFiltersResponse {
  departments: Array<{departmentId: string, departmentName: string}>;
  subdepartments: Array<{subdepartmentId: string, subdepartmentName: string, departmentId: string}>;
  userRole: {
    isKaryalay: boolean;
    isHOD: boolean;
  };
}

// Media-related Types
export interface MediaFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  message?: string; // Optional message for each media file
}

// Chat-related Types
export interface Message {
  id: number | string;
  roomId: number | string; // Accept either number or string
  senderId: string;
  senderName: string;
  messageText: string;
  createdAt: string;  
  messageType:string;
  mediaFilesId?: number; // Optional array of media files
  pollId?: number;
  tableId?:number;
  replyMessageId?: number;
  replyMessageText?: string;
  replyMessageType?: string;
  replySenderName?: string;
  isEdited?: boolean;
  editedAt?: string;
  editedBy?: string;
  editorName?: string;
}

export interface ChatRoom {
  roomId?: number;
  roomName: string;
  roomDescription?: string;
  createdOn?: string;
  isGroup?: boolean;
  createdBy?: string;
  isAdmin?: boolean;
  canSendMessage?: boolean;
  isAvailableForForwarding?: boolean;
}

export interface ChatUser {
  userId: string;
  fullName?: string | null;
  mobileNumber?: string;
  departments?: string[];
  isAdmin?: boolean;
  isOnline?: boolean;
}

export interface ChatRoomUser {
  id: number;
  roomId: number;
  userId: string;
  isAdmin: boolean;
  canSendMessage: boolean;
  joinedAt: string;
}



// Admin-related Types
export interface PendingUser {
  userId: string;
  mobileNumber: string;
  fullName?: string;
}

// Authentication-related Types
export interface LoginResponse {
  success: boolean;
  token: string;
  userId: string;
  isAdmin: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorDepartments?: string[];
  departmentTag?: string[];
  thumbnail: string;
  hasCoverImage?: boolean;
  createdAt: string;
  updatedAt: string;
  status?: 'published' | 'scheduled' | 'draft';
  likedBy: Array<{
    userId: string;
    fullName: string;
    likedAt: string;
  }>;
  readBy: Array<{
    userId: string;
    fullName: string;
    readAt: string;
  }>;
}

export interface LikedUser {
  userId: string;
  fullName: string;
  likedAt: string;
}

export interface ReadUser {
  userId: string;
  fullName: string;
  readAt: string;
}

// Utility Types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;