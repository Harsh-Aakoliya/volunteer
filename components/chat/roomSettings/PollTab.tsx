import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage } from '@/utils/authStorage';
import PollMessage from '@/components/chat/PollMessage';

const PAGE_SIZE = 15;

export default function PollTab({ messages }: { messages: any[] }) {
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const polls = messages.filter(
    (message) => message.messageType === 'poll' && message.pollId
  );

  const visiblePolls = polls.slice(0, visibleCount);
  const hasMore = visibleCount < polls.length;

  useEffect(() => {
    let cancelled = false;
    AuthStorage.getUser().then((user) => {
      if (!cancelled && user?.userId != null) {
        setCurrentUserId(String(user.userId));
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, polls.length));
  }, [hasMore, polls.length]);

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={visiblePolls}
        keyExtractor={(item) => `poll-${item.id}-${item.pollId}`}
        contentContainerStyle={
          visiblePolls.length === 0
            ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
            : { padding: 16, paddingBottom: 24 }
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <View
            style={{
              marginBottom: 24,
              paddingBottom: 24,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
            }}
          >
            <PollMessage
              pollId={item.pollId}
              currentUserId={currentUserId}
              onViewResults={() => {}}
              readOnly
            />
          </View>
        )}
        ListEmptyComponent={
          <>
            <Ionicons name="bar-chart-outline" size={64} color="#d1d5db" />
            <Text className="text-gray-600 mt-4 text-lg font-medium">
              No Polls
            </Text>
            <Text className="text-gray-400 mt-2 text-center px-6">
              Polls created in this room will appear here
            </Text>
          </>
        }
      />
    </View>
  );
}
