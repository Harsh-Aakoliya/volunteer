// components/chat/roomSettings/MembersTab.tsx
import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSocket, useUserOnlineStatus } from '@/contexts/SocketContext';
import socketManager from '@/utils/socketManager';

interface Member {
  userId: string;
  fullName: string | null;
  isAdmin: boolean;
  isOnline: boolean;
}

interface MembersTabProps {
  members: Member[];
  roomId?: string;
  onlineUsers?: string[];
}

// Memoized member item component
const MemberItem = memo(({ item }: { item: Member }) => {
  return (
    <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
      {/* Member Icon with status and admin badge */}
      <View className="relative mr-3">
        {/* Main avatar circle */}
        <View className="w-12 h-12 bg-blue-100 rounded-full justify-center items-center">
          <Text className="text-blue-600 font-bold text-lg">
            {(item.fullName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Online/Offline status dot - top right */}
        <View
          className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
            item.isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />

        {/* Admin badge - bottom right */}
        {item.isAdmin && (
          <View className="absolute bottom-0 right-0 bg-yellow-400 rounded-full w-5 h-5 items-center justify-center border-2 border-white">
            <Ionicons name="star" size={12} color="#fff" />
          </View>
        )}
      </View>

      {/* Member Name and Status */}
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">
          {item.fullName || 'Unknown User'}
        </Text>
        <Text className={`text-xs ${item.isOnline ? 'text-green-500' : 'text-gray-400'}`}>
          {item.isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
    </View>
  );
});

MemberItem.displayName = 'MemberItem';

function MembersTab({ members: initialMembers, roomId, onlineUsers: initialOnlineUsers = [] }: MembersTabProps) {
  const { isConnected, requestOnlineUsers } = useSocket();

  const [members, setMembers] = useState<Member[]>(
    initialMembers.map(m => ({ ...m, userId: String(m.userId) }))
  );
  const [onlineUsers, setOnlineUsers] = useState<string[]>(
    initialOnlineUsers.map(String)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update members when prop changes
  useEffect(() => {
    setMembers(initialMembers.map(m => ({ ...m, userId: String(m.userId) })));
  }, [initialMembers]);

  // Update online users when prop changes
  useEffect(() => {
    setOnlineUsers(initialOnlineUsers.map(String));
  }, [initialOnlineUsers]);

  // Subscribe to online status updates
  useEffect(() => {
    if (!isConnected || !roomId) return;

    // Subscribe to online users for this room
    const onlineUsersSub = socketManager.on('onlineUsers', (data: { roomId: string; users: string[] }) => {
      if (data.roomId === roomId) {
        setOnlineUsers(data.users.map(String));
      }
    });

    // Subscribe to user status changes
    const userStatusSub = socketManager.on('userStatusChange', (data: { userId: string; isOnline: boolean }) => {
      const userId = String(data.userId);
      if (data.isOnline) {
        setOnlineUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== userId));
      }
    });

    return () => {
      socketManager.off(onlineUsersSub);
      socketManager.off(userStatusSub);
    };
  }, [isConnected, roomId]);

  // Compute members with online status
  const membersWithStatus = useMemo(() => {
    const updatedMembers = members.map(member => ({
      ...member,
      isOnline: onlineUsers.includes(String(member.userId)),
    }));

    // Sort: online first, then admins, then alphabetically
    return updatedMembers.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [members, onlineUsers]);

  // Key extractor
  const keyExtractor = useCallback((item: Member) => String(item.userId), []);

  // Render item
  const renderItem = useCallback(({ item }: { item: Member }) => (
    <MemberItem item={item} />
  ), []);

  // Get item layout for better performance
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 72,
    offset: 72 * index,
    index,
  }), []);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (roomId && isConnected) {
      requestOnlineUsers(roomId);
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [roomId, isConnected, requestOnlineUsers]);

  // Stats
  const onlineCount = membersWithStatus.filter(m => m.isOnline).length;
  const adminCount = membersWithStatus.filter(m => m.isAdmin).length;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Stats Header */}
      {/* <View className="px-4 py-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
        <View className="flex-row items-center">
          <View className="flex-row items-center mr-4">
            <View className="w-2 h-2 bg-green-500 rounded-full mr-1.5" />
            <Text className="text-sm text-gray-600">{onlineCount} online</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="star" size={12} color="#facc15" style={{ marginRight: 4 }} />
            <Text className="text-sm text-gray-600">{adminCount} admins</Text>
          </View>
        </View>
        <Text className="text-sm text-gray-500">
          {membersWithStatus.length} total
        </Text>
      </View> */}

      <FlatList
        data={membersWithStatus}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View className="p-8 items-center">
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text className="text-gray-500 mt-4">No members found</Text>
          </View>
        }
      />
    </View>
  );
}

export default memo(MembersTab);
