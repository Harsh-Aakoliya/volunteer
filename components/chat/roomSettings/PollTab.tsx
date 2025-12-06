import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PollTab() {
  return (
    <View className="flex-1 bg-gray-50 justify-center items-center p-8">
      <Ionicons name="bar-chart-outline" size={64} color="#d1d5db" />
      <Text className="text-gray-500 mt-4 text-lg font-medium">No Polls</Text>
      <Text className="text-gray-400 mt-2 text-center">
        Polls created in this room will appear here
      </Text>
    </View>
  );
}

