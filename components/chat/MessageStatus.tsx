// components/chat/MessageStatus.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  className?: string;
}

const MessageStatus: React.FC<MessageStatusProps> = ({ status, className }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Ionicons name="time-outline" size={12} color="#FFFFFF" />;
      case 'sent':
        return <Ionicons name="checkmark-outline" size={12} color="#FFFFFF" />;
      case 'delivered':
        return <Ionicons name="checkmark-done-outline" size={12} color="#FFFFFF" />;
      case 'read':
        return <Ionicons name="checkmark-done-outline" size={12} color="#4ade80" />;
      case 'error':
        return <Ionicons name="alert-circle-outline" size={12} color="#ef4444" />;
      default:
        return <Ionicons name="checkmark-outline" size={12} color="#FFFFFF" />;
    }
  };

  return (
    <View className={`flex-row items-center ${className || ''}`}>
      {getStatusIcon()}
    </View>
  );
};

export default MessageStatus;