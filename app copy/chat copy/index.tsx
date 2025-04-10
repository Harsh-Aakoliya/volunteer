// app/(tabs)/chat/index.tsx
import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { router } from 'expo-router';
import CustomButton from '@/components/ui/CustomButton';

export default function ChatListScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4">
        <CustomButton
          title="New Chat"
          onPress={() => router.push('/chat/new')}
          bgVariant="primary"
          textVariant="default"
        />
      </View>
      {/* Add your chat list here */}
    </View>
  );
}