import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ScrollView } from 'react-native';
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
}

export default function MembersTab({ members: initialMembers, roomId }: MembersTabProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);

  // Update members when prop changes
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  // Listen for online status updates
  useEffect(() => {
    const handleOnlineStatusUpdate = (data: { userId: string; isOnline: boolean }) => {
      console.log('🔄 Online status update received:', data);
      
      // Update the member's online status in real-time
      setMembers(prevMembers => 
        prevMembers.map(member => 
          member.userId === data.userId 
            ? { ...member, isOnline: data.isOnline }
            : member
        )
      );
    };

    const handleRoomMembers = (data: { roomId: string; members: Member[] }) => {
      console.log('🔄 Room members update received:', data);
      
      // Update members if this is for our room
      if (roomId && data.roomId === roomId.toString()) {
        setMembers(data.members);
      }
    };

    // Subscribe to online status updates
    socketService.onUserOnlineStatusUpdate(handleOnlineStatusUpdate);
    socketService.onRoomMembers(handleRoomMembers);

    return () => {
      // Cleanup listeners when component unmounts
      if (socketService.socket) {
        socketService.socket.off("userOnlineStatusUpdate", handleOnlineStatusUpdate);
        socketService.socket.off("roomMembers", handleRoomMembers);
      }
    };
  }, [roomId]);
  // Sort members: admins first, then regular members
  const sortedMembers = [...members].sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return 0;
  });

  const renderMemberItem = ({ item }: { item: Member }) => {
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
              item.isOnline ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          
          {/* Admin badge - bottom right */}
          {item.isAdmin && (
            <View className="absolute bottom-0 right-0 bg-yellow-400 rounded-full w-5 h-5 items-center justify-center border-2 border-white">
              <Ionicons name="star" size={12} color="#fff" />
            </View>
          )}
        </View>
        
        {/* Member Name */}
        <View className="flex-1">
          <Text className="text-base font-medium text-gray-900">
            {item.fullName || 'Unknown User'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={sortedMembers}
        keyExtractor={(item) => item.userId}
        renderItem={renderMemberItem}
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

