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

// User-related Types
export interface User {
  userId: string;
  mobileNumber: string;
  isAdmin: boolean;
  isMaster: boolean;
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
  isForwarded?: boolean;
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

// Utility Types
export type Optional<T> = T | undefined;