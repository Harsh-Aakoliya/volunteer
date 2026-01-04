import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AnnouncementsTab({
  messages,
}: {
  messages: any[];
}) {
  const announcements = messages.filter(
    message => message.messageType === 'announcement'
  );

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={announcements}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={
          announcements.length === 0
            ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
            : { padding: 16 }
        }
        renderItem={({ item }) => (
          <Text className="text-base text-gray-800 mb-2">
            {item.id}
          </Text>
        )}
        ListEmptyComponent={
          <>
            <Ionicons name="megaphone-outline" size={64} color="#d1d5db" />
            <Text className="text-gray-600 mt-4 text-lg font-medium">
              No Announcements
            </Text>
            <Text className="text-gray-400 mt-2 text-center">
              Announcements sent to this room will appear here
            </Text>
          </>
        }
      />
    </View>
  );
}
