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
  department?: string;
  departmentId?: string;
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
  adminList: string[];
  userList: string[];
  createdByName?: string;
  adminCount?: number;
  userCount?: number;
}

export interface DepartmentUser {
  userId: string;
  fullName: string;
  mobileNumber: string;
  isAdmin: boolean;
  department?: string;
  departmentId?: string;
  xetra?: string;
  mandal?: string;
  role?: string;
}

export interface CreateDepartmentRequest {
  departmentName: string;
  adminList: string[];
  userList: string[];
}

export interface UpdateDepartmentRequest {
  departmentId: string;
  adminList?: string[];
  userList?: string[];
  departmentName?: string;
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
  tableId?:number
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

// Announcement-related Types
export interface Announcement {
  id: number;
  title: string;
  body: string;
  authorId: string;
  authorName?: string;
  hasCoverImage?: boolean;
  createdAt: string;
  likes: string[];
  dislikes: number;
  readBy: ReadEntry[];
  updatedAt: string;
  status:string;
}

export interface ReadEntry {
  userId: string;
  readAt: string;
}

export interface LikedUser {
  userId: string;
  fullName: string;
}

export interface ReadUser {
  userId: string;
  fullName: string;
  readAt: string;
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

// Utility Types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;