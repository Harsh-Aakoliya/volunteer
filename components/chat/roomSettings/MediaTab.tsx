import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MediaTab({ messages }: { messages: any[] }) {
  const media = messages.filter(
    message => message.messageType === 'media'
  );

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={media}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={
          media.length === 0
            ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
            : { padding: 16 }
        }
        renderItem={({ item }) => (
          <Text className="text-base text-gray-800 mb-2">
            {item.mediaFilesId}
          </Text>
        )}
        ListEmptyComponent={
          <>
            <Ionicons name="images-outline" size={64} color="#d1d5db" />
            <Text className="text-gray-600 mt-4 text-lg font-medium">
              No Media Files
            </Text>
            <Text className="text-gray-400 mt-2 text-center">
              Photos and videos shared in this room will appear here
            </Text>
          </>
        }
      />
    </View>
  );
}
