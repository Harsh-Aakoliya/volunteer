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
  totalSabha?: number;
  presentCount?: number;
  absentCount?: number;
  isApproved?: boolean;
}

// Chat-related Types
export interface Message {
  id: number;
  roomId: number | string; // Accept either number or string
  senderId: string;
  senderName: string;
  messageText: string;
  createdAt: string;
}
export interface ChatRoom {
  roomId?: number;
  roomName: string;
  roomDescription?: string;
  createdOn?: string;
  isGroup?: boolean;
  createdBy?: string;
}

export interface ChatUser {
  userId: string;
  fullName?: string;
  mobileNumber?: string;
  isAdmin?: boolean;
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
  createdAt: string;
  likes: number;
  dislikes: number;
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