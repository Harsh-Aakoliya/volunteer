import React, {
  useEffect,
  useState,
  useCallback,
  memo,
  useMemo,
} from 'react';
import { View, Text, SectionList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '@/contexts/SocketContext';
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

/* ----------------------------- Member Item ----------------------------- */

const MemberItem = memo(({ item }: { item: Member }) => {
  return (
    <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
      <View className="relative mr-3">
        <View className="w-12 h-12 bg-blue-100 rounded-full justify-center items-center">
          <Text className="text-blue-600 font-bold text-lg">
            {(item.fullName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View
          className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
            item.isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </View>

      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">
          {item.fullName || 'Unknown User'}
        </Text>
        <Text
          className={`text-xs ${
            item.isOnline ? 'text-green-500' : 'text-gray-400'
          }`}
        >
          {item.isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
    </View>
  );
});

MemberItem.displayName = 'MemberItem';

/* ----------------------------- Members Tab ----------------------------- */

function MembersTab({
  members: initialMembers,
  roomId,
  onlineUsers: initialOnlineUsers = [],
}: MembersTabProps) {
  const { isConnected, requestOnlineUsers } = useSocket();

  const [members, setMembers] = useState<Member[]>(
    initialMembers.map(m => ({ ...m, userId: String(m.userId) }))
  );
  const [onlineUsers, setOnlineUsers] = useState<string[]>(
    initialOnlineUsers.map(String)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setMembers(initialMembers.map(m => ({ ...m, userId: String(m.userId) })));
  }, [initialMembers]);

  useEffect(() => {
    setOnlineUsers(initialOnlineUsers.map(String));
  }, [initialOnlineUsers]);

  useEffect(() => {
    if (!isConnected || !roomId) return;

    const onlineUsersSub = socketManager.on(
      'onlineUsers',
      (data: { roomId: string; users: string[] }) => {
        if (data.roomId === roomId) {
          setOnlineUsers(data.users.map(String));
        }
      }
    );

    const userStatusSub = socketManager.on(
      'userStatusChange',
      (data: { userId: string; isOnline: boolean }) => {
        const userId = String(data.userId);
        setOnlineUsers(prev =>
          data.isOnline
            ? prev.includes(userId)
              ? prev
              : [...prev, userId]
            : prev.filter(id => id !== userId)
        );
      }
    );

    return () => {
      socketManager.off(onlineUsersSub);
      socketManager.off(userStatusSub);
    };
  }, [isConnected, roomId]);

  /* ----------------------- Section Data ----------------------- */

  const sections = useMemo(() => {
    const admins = members
      .filter(m => m.isAdmin)
      .map(m => ({
        ...m,
        isOnline: onlineUsers.includes(String(m.userId)),
      }))
      .sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return (a.fullName || '').localeCompare(b.fullName || '');
      });

    const normalMembers = members
      .filter(m => !m.isAdmin)
      .map(m => ({
        ...m,
        isOnline: onlineUsers.includes(String(m.userId)),
      }))
      .sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return (a.fullName || '').localeCompare(b.fullName || '');
      });

    return [
      admins.length > 0 && {
        title: `Admins (${admins.length})`,
        data: admins,
      },
      {
        title: `Members (${normalMembers.length})`,
        data: normalMembers,
      },
    ].filter(Boolean) as { title: string; data: Member[] }[];
  }, [members, onlineUsers]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (roomId && isConnected) {
      requestOnlineUsers(roomId);
    }
    setTimeout(() => setIsRefreshing(false), 800);
  }, [roomId, isConnected, requestOnlineUsers]);

  return (
    <View className="flex-1 bg-gray-50">
      <SectionList
        sections={sections}
        keyExtractor={item => item.userId}
        renderItem={({ item }) => <MemberItem item={item} />}
        renderSectionHeader={({ section }) => (
          <Text className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
            {section.title}
          </Text>
        )}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        stickySectionHeadersEnabled={false}
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
