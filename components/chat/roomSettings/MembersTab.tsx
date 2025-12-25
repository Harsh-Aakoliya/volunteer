// components/chat/roomSettings/MembersTab.tsx
import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import socketService from '@/utils/socketService';

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
  const normalizeMembers = (list: Member[]) =>
    list.map(m => ({ ...m, userId: String(m.userId) }));
  const normalizeOnline = (list: string[]) => list.map(String);

  const [members, setMembers] = useState<Member[]>(normalizeMembers(initialMembers));
  const [onlineUsers, setOnlineUsers] = useState<string[]>(normalizeOnline(initialOnlineUsers));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const membersRef = useRef<Member[]>(initialMembers);

  // Keep ref in sync
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // Update members when prop changes
  useEffect(() => {
    setMembers(normalizeMembers(initialMembers));
  }, [initialMembers]);

  // Update online users when prop changes
  useEffect(() => {
    setOnlineUsers(normalizeOnline(initialOnlineUsers));
  }, [initialOnlineUsers]);

  // Listen for online status updates
  useEffect(() => {
    const handleOnlineStatusUpdate = (data: { userId: string; isOnline: boolean }) => {
      console.log('🔄 MembersTab: Online status update:', data);
      
      if (data.isOnline) {
        setOnlineUsers(prev => 
          prev.includes(data.userId) ? prev : [...prev, data.userId]
        );
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      }
    };

    const handleRoomOnlineUsers = (data: { roomId: string; onlineUsers: string[] }) => {
      console.log('🔄 MembersTab: Room online users:', data);
      if (roomId && data.roomId === roomId.toString()) {
        setOnlineUsers(data.onlineUsers);
      }
    };

    // Subscribe to updates
    if (socketService.socket) {
      socketService.socket.on('userOnlineStatusUpdate', handleOnlineStatusUpdate);
      socketService.socket.on('roomOnlineUsers', handleRoomOnlineUsers);

      // Request current online users
      if (roomId) {
        socketService.socket.emit('getRoomOnlineUsers', { roomId });
      }
    }

    return () => {
      if (socketService.socket) {
        socketService.socket.off('userOnlineStatusUpdate', handleOnlineStatusUpdate);
        socketService.socket.off('roomOnlineUsers', handleRoomOnlineUsers);
      }
    };
  }, [roomId]);

  // Compute members with online status
  const membersWithStatus = React.useMemo(() => {
    const updatedMembers = members.map(member => ({
      ...member,
      isOnline: onlineUsers.includes(member.userId),
    }));

    // Sort: online first, then admins, then alphabetically
    return updatedMembers.sort((a, b) => {
      // Online status first
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      
      // Then admin status
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      
      // Then alphabetically
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [members, onlineUsers]);

  // Key extractor
  const keyExtractor = useCallback((item: Member) => item.userId, []);

  // Render item
  const renderItem = useCallback(({ item }: { item: Member }) => (
    <MemberItem item={item} />
  ), []);

  // Get item layout for better performance
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 72, // Approximate height of each item
    offset: 72 * index,
    index,
  }), []);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (socketService.socket && roomId) {
      socketService.socket.emit('getRoomOnlineUsers', { roomId });
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [roomId]);

  // Stats
  const onlineCount = membersWithStatus.filter(m => m.isOnline).length;
  const adminCount = membersWithStatus.filter(m => m.isAdmin).length;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Stats Header */}
      <View className="px-4 py-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
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
      </View>

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