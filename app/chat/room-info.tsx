// app/chat/room-info.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import { useFocusEffect } from '@react-navigation/native';
import { TabView, TabBar } from 'react-native-tab-view';
import MembersTab from '@/components/chat/roomSettings/MembersTab';
import AnnouncementsTab from '@/components/chat/roomSettings/AnnouncementsTab';
import MediaTab from '@/components/chat/roomSettings/MediaTab';
import PollTab from '@/components/chat/roomSettings/PollTab';
import { useSocket } from '@/contexts/SocketContext';
import socketManager from '@/utils/socketManager';
import { Message } from '@/types/type';

interface Member {
  userId: string;
  fullName: string | null;
  isAdmin: boolean;
  isOnline: boolean;
}

export default function RoomInfo() {
  const layout = useWindowDimensions();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  // Socket context
  const { isConnected, requestOnlineUsers } = useSocket();

  // State
  const [members, setMembers] = useState<Member[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomName, setRoomName] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  // Tab view state
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'members', title: 'Members' },
    { key: 'announcements', title: 'Announcements' },
    { key: 'media', title: 'Media' },
    { key: 'poll', title: 'Poll' },
  ]);

  // Apply online status to members
  const membersWithOnlineStatus = useMemo(() => {
    return members.map(member => ({
      ...member,
      isOnline: onlineUsers.includes(member.userId),
    }));
  }, [members, onlineUsers]);

  // Load room info
  const loadRoomInfo = useCallback(async () => {
    try {
      setIsLoading(true);

      const token = await AuthStorage.getToken();
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("response.data", response.data);

      setMembers(response.data.members || []);
      setRoomName(response.data.roomName || '');
      setMessages(response.data.messages || []);

    } catch (error) {
      console.error('Error loading room info:', error);
      alert('Failed to load room info');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  // Subscribe to online status updates
  useEffect(() => {
    if (!isConnected || !roomId) return;

    // Request current online users
    requestOnlineUsers(roomId);

    // Subscribe to online users for this room
    const onlineUsersSub = socketManager.on('onlineUsers', (data: { roomId: string; users: string[] }) => {
      if (data.roomId === roomId) {
        setOnlineUsers(data.users);
      }
    });

    // Subscribe to user status changes
    const userStatusSub = socketManager.on('userStatusChange', (data: { userId: string; isOnline: boolean }) => {
      if (data.isOnline) {
        setOnlineUsers(prev => prev.includes(data.userId) ? prev : [...prev, data.userId]);
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      }
    });

    return () => {
      socketManager.off(onlineUsersSub);
      socketManager.off(userStatusSub);
    };
  }, [isConnected, roomId, requestOnlineUsers]);

  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        loadRoomInfo();
        if (isConnected) {
          requestOnlineUsers(roomId);
        }
      }
      return () => {};
    }, [roomId, loadRoomInfo, isConnected, requestOnlineUsers])
  );

  // Render scene
  const renderScene = useCallback(({ route }: { route: { key: string } }) => {
    switch (route.key) {
      case 'members':
        return (
          <MembersTab
            members={membersWithOnlineStatus}
            roomId={roomId as string}
            onlineUsers={onlineUsers}
          />
        );
      case 'announcements':
        return <AnnouncementsTab 
          messages={messages}
        />;
      case 'media':
        return <MediaTab 
          messages={messages}
        />;
      case 'poll':
        return <PollTab 
          messages={messages}
        />;
      default:
        return null;
    }
  }, [membersWithOnlineStatus, roomId, onlineUsers]);

  // Custom TabBar
  const renderTabBar = useCallback((props: any) => (
    <TabBar
      {...props}
      indicatorStyle={styles.tabIndicator}
      style={styles.tabBar}
      tabStyle={styles.tab}
      labelStyle={styles.tabLabel}
      inactiveColor="#6b7280"
      activeColor="#3b82f6"
      scrollEnabled={true}
      bounces={true}
      pressColor="rgba(59, 130, 246, 0.1)"
      gap={8}
    />
  ), []);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        <View className="flex-1 mx-4">
          <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
            {roomName}
          </Text>
          <Text className="text-xs text-gray-500">
            {onlineUsers.length} online • {members.length} members
          </Text>
        </View>
      </View>

      {/* Tab View */}
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={renderTabBar}
        lazy={true}
        lazyPreloadDistance={0}
        swipeEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabIndicator: {
    backgroundColor: '#3b82f6',
    height: 3,
    borderRadius: 1.5,
  },
  tabBar: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    width: 'auto',
    paddingHorizontal: 16,
  },
  tabLabel: {
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'none',
  },
});
