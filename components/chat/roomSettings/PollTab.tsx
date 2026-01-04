import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PollTab({ messages }: { messages: any[] }) {
  const polls = messages.filter(
    message => message.messageType === 'poll'
  );

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={polls}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={
          polls.length === 0
            ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
            : { padding: 16 }
        }
        renderItem={({ item }) => (
          <Text className="text-base text-gray-800 mb-2">
            {item.pollId}
          </Text>
        )}
        ListEmptyComponent={
          <>
            <Ionicons name="bar-chart-outline" size={64} color="#d1d5db" />
            <Text className="text-gray-600 mt-4 text-lg font-medium">
              No Polls
            </Text>
            <Text className="text-gray-400 mt-2 text-center">
              Polls created in this room will appear here
            </Text>
          </>
        }
      />
    </View>
  );
}
