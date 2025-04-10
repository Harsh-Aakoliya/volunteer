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
  id: number;
  mobile_number: string;
  specific_id: string;
  full_name: string;
  xetra?: string;
  mandal?: string;
  role?: string;
  total_sabha?: number;
  present_count?: number;
  absent_count?: number;
  isAdmin?: boolean;
  is_approved?: boolean;
  recent_attendance?: Attendance[];
}

// Chat-related Types
export interface Message {
    id: number;
    room_id: number;
    sender_id: number;
    sender_name: string;
    content: string;
    created_at: string;
    read_by: string[];
}

// export interface ChatRoom {
//     id: number;
//     name: string;
//     description: string | null;
//     is_group: boolean;
//     created_at: string;
//     display_name: string;
//     unread_count: number;
//     last_message: string | null;
//     last_activity: string | null;
// }

export interface ChatUser {
    id: number;
    full_name: string;
    mobile_number: string;
    mandal: string;
    xetra: string;
}

// Attendance-related Types
export interface AttendanceRecord {
    id: number;
    user_id: number;
    date: string;
    status: 'present' | 'absent' | 'leave';
    remarks?: string;
}
export interface Attendance {
  date: string;
  time_slot: string;
  status: 'present' | 'absent' | 'late';
  late_minutes?: number;
}

// Announcement-related Types
export interface Announcement {
    id: number;
    title: string;
    body: string;
    created_at: string;
    likes: number;
    dislikes: number;
}

// Admin-related Types
export interface PendingUser {
    id: number;
    mobile_number: string;
    specific_id: string;
}

// Authentication-related Types
export interface LoginResponse {
    success: boolean;
    token: string;
    user: User;
    isAdmin: boolean;
}
export interface ChatRoom {
    id?: number;
    room_name: string;
    room_description?: string;
    created_on?: string;
    is_group?: boolean;
  }
  
  export interface ChatUser {
    id: number;
    full_name: string;
    mobile_number: string;
  }
// Utility Types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;