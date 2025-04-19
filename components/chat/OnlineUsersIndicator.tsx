// components/chat/OnlineUsersIndicator.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OnlineUsersIndicatorProps {
  onlineCount: number;
  totalCount: number;
  onPress?: () => void;
}

const OnlineUsersIndicator: React.FC<OnlineUsersIndicatorProps> = ({ 
  onlineCount, 
  totalCount, 
  onPress 
}) => {
  return (
    <TouchableOpacity 
      className="px-4 py-2 bg-gray-100 border-b border-gray-200"
      onPress={onPress}
      disabled={!onPress}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="h-2.5 w-2.5 bg-green-500 rounded-full mr-2" />
          <Text className="text-gray-600 text-sm">
            {onlineCount} / {totalCount} members online
          </Text>
        </View>
        {onPress && (
          <Ionicons name="chevron-down" size={16} color="#6B7280" />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default OnlineUsersIndicator;