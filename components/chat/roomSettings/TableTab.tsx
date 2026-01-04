import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TableTab({ messages }: { messages: any[] }) {
  const tables = messages.filter(
    message => message.messageType === 'table'
  );

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={tables}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={
          tables.length === 0
            ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
            : { padding: 16 }
        }
        renderItem={({ item }) => (
          <Text className="text-base text-gray-800 mb-2">
            {item.tableId}
          </Text>
        )}
        ListEmptyComponent={
          <>
            <Ionicons name="grid-outline" size={64} color="#d1d5db" />
            <Text className="text-gray-600 mt-4 text-lg font-medium">
              No Tables
            </Text>
            <Text className="text-gray-400 mt-2 text-center">
              Tables shared in this room will appear here
            </Text>
          </>
        }
      />
    </View>
  );
}
