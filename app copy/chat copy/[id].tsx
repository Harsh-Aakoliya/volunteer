// Add new interfaces for chat-related types
export interface User {
  id: number;
  name?: string;
  email?: string;
  mobile_number?: string;
}

export interface Message {
  id: number;
  sender_id: number;
  content: string;
  created_at: string;
}

export interface ChatRoom {
  id: number;
  display_name: string;
}