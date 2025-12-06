import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AnnouncementsTab() {
  return (
    <View className="flex-1 bg-gray-50 justify-center items-center p-8">
      <Ionicons name="megaphone-outline" size={64} color="#d1d5db" />
      <Text className="text-gray-500 mt-4 text-lg font-medium">No Announcements</Text>
      <Text className="text-gray-400 mt-2 text-center">
        Announcements sent to this room will appear here
      </Text>
    </View>
  );
}

