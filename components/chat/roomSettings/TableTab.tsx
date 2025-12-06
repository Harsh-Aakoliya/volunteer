import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TableTab() {
  return (
    <View className="flex-1 bg-gray-50 justify-center items-center p-8">
      <Ionicons name="grid-outline" size={64} color="#d1d5db" />
      <Text className="text-gray-500 mt-4 text-lg font-medium">No Tables</Text>
      <Text className="text-gray-400 mt-2 text-center">
        Tables shared in this room will appear here
      </Text>
    </View>
  );
}

