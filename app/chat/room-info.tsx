// app/chat/room-info.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import TableTab from '@/components/chat/roomSettings/TableTab';
import RoomSettingsMenu from '@/components/chat/roomSettings/RoomSettingsMenu';
import socketService from '@/utils/socketService';

// Bottom Sheet imports
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';

interface Member {
  userId: string;
  fullName: string | null;
  isAdmin: boolean;
  isOnline: boolean;
}

export default function RoomInfo() {
  const layout = useWindowDimensions();
  const { 
    roomId, 
    roomName: initialRoomName,
    roomDescription: initialDescription,
    membersData,
    onlineUsersData,
    isGroupAdmin: isGroupAdminParam,
  } = useLocalSearchParams<{
    roomId: string;
    roomName?: string;
    roomDescription?: string;
    membersData?: string;
    onlineUsersData?: string;
    isGroupAdmin?: string;
  }>();

  // Parse initial data from params
  const parsedInitialMembers = useMemo(() => {
    if (membersData) {
      try {
        return JSON.parse(membersData) as Member[];
      } catch {
        return [];
      }
    }
    return [];
  }, [membersData]);

  const parsedOnlineUsers = useMemo(() => {
    if (onlineUsersData) {
      try {
        return JSON.parse(onlineUsersData) as string[];
      } catch {
        return [];
      }
    }
    return [];
  }, [onlineUsersData]);

  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>(parsedInitialMembers);
  const [onlineUsers, setOnlineUsers] = useState<string[]>(parsedOnlineUsers);
  const [isLoading, setIsLoading] = useState(parsedInitialMembers.length === 0);
  const [roomName, setRoomName] = useState(initialRoomName || '');
  const [roomDescription, setRoomDescription] = useState(initialDescription || '');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState(isGroupAdminParam === 'true');
  const [isCreator, setIsCreator] = useState(false);

  // Refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  const membersRef = useRef<Member[]>(parsedInitialMembers);

  // Keep ref in sync
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // Snap points for bottom sheet
  const snapPoints = useMemo(() => ['50%', '75%', '90%'], []);

  // Tab view state
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'members', title: 'Members' },
    { key: 'announcements', title: 'Announcements' },
    { key: 'media', title: 'Media' },
    { key: 'poll', title: 'Poll' },
    { key: 'table', title: 'Table' },
  ]);

  // Apply online status to members
  const membersWithOnlineStatus = useMemo(() => {
    return members.map(member => ({
      ...member,
      isOnline: onlineUsers.includes(member.userId),
    }));
  }, [members, onlineUsers]);

  // Load room info (only if not passed via params)
  const loadRoomInfo = useCallback(async (forceRefresh = false) => {
    try {
      // Skip loading if we have initial data and not forcing refresh
      if (!forceRefresh && parsedInitialMembers.length > 0 && roomName) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // Get current user
      const userData = await AuthStorage.getUser();
      setCurrentUser(userData);

      // Fetch room details
      const token = await AuthStorage.getToken();
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRoomDetails(response.data);
      setMembers(response.data.members || []);
      setRoomName(response.data.roomName || '');
      setRoomDescription(response.data.roomDescription || '');

      // Check if current user is group admin
      const isUserGroupAdmin = response.data.members.some(
        (member: any) => member.userId === userData?.userId && member.isAdmin
      );
      setIsGroupAdmin(isUserGroupAdmin);
      setIsCreator(response.data.isCreator || false);
    } catch (error) {
      console.error('Error loading room info:', error);
      if (parsedInitialMembers.length === 0) {
        alert('Failed to load room info');
        router.back();
      }
    } finally {
      setIsLoading(false);
    }
  }, [roomId, parsedInitialMembers.length, roomName]);

  // Initialize current user
  useEffect(() => {
    const initUser = async () => {
      const userData = await AuthStorage.getUser();
      setCurrentUser(userData);
    };
    initUser();
  }, []);

  // Socket listeners for online status
  useEffect(() => {
    const handleUserOnlineStatus = (data: { userId: string; isOnline: boolean }) => {
      console.log('🟢 Room-info: Online status update:', data);
      
      if (data.isOnline) {
        setOnlineUsers(prev => 
          prev.includes(data.userId) ? prev : [...prev, data.userId]
        );
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      }
    };

    const handleRoomOnlineUsers = (data: { roomId: string; onlineUsers: string[] }) => {
      console.log('🟢 Room-info: Room online users:', data);
      if (data.roomId === roomId) {
        setOnlineUsers(data.onlineUsers);
      }
    };

    // Subscribe to socket events
    if (socketService.socket) {
      socketService.socket.on('userOnlineStatusUpdate', handleUserOnlineStatus);
      socketService.socket.on('roomOnlineUsers', handleRoomOnlineUsers);

      // Request current online users for this room
      socketService.socket.emit('getRoomOnlineUsers', { roomId });
    }

    return () => {
      if (socketService.socket) {
        socketService.socket.off('userOnlineStatusUpdate', handleUserOnlineStatus);
        socketService.socket.off('roomOnlineUsers', handleRoomOnlineUsers);
      }
    };
  }, [roomId]);

  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        loadRoomInfo();

        // Request fresh online status when focusing
        if (socketService.socket?.connected) {
          socketService.socket.emit('getRoomOnlineUsers', { roomId });
        }
      }
      return () => {};
    }, [roomId, loadRoomInfo])
  );

  // Render scene with memoization
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
        return <AnnouncementsTab roomId={roomId as string} />;
      case 'media':
        return <MediaTab roomId={roomId as string} />;
      case 'poll':
        return <PollTab roomId={roomId as string} />;
      case 'table':
        return <TableTab roomId={roomId as string} />;
      default:
        return null;
    }
  }, [membersWithOnlineStatus, roomId, onlineUsers]);

  // Custom TabBar render
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

  // Bottom sheet handlers
  const handleOpenBottomSheet = useCallback(() => {
    bottomSheetRef.current?.expand();
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  // Handle component for bottom sheet
  const renderHandle = useCallback(
    () => (
      <View style={styles.handleContainer}>
        <View style={styles.dragIndicator} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Room Settings</Text>
          <TouchableOpacity
            onPress={handleCloseBottomSheet}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleCloseBottomSheet]
  );

  // Handle refresh from bottom sheet
  const handleRefresh = useCallback(() => {
    loadRoomInfo(true);
  }, [loadRoomInfo]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Custom Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        <View className="flex-1 mx-4">
          <Text
            className="text-lg font-semibold text-gray-900"
            numberOfLines={1}
          >
            {roomName}
          </Text>
          <Text className="text-xs text-gray-500">
            {onlineUsers.length} online • {members.length} members
          </Text>
        </View>

        {isGroupAdmin ? (
          <TouchableOpacity
            onPress={handleOpenBottomSheet}
            className="p-2 bg-gray-100 rounded-full"
          >
            <Ionicons name="menu" size={24} color="#374151" />
          </TouchableOpacity>
        ) : (
          <View className="w-10" />
        )}
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

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backdropComponent={renderBackdrop}
        handleComponent={renderHandle}
        backgroundStyle={styles.sheetBackground}
        style={styles.sheet}
      >
        <BottomSheetView style={styles.sheetContent}>
          <RoomSettingsMenu
            roomId={roomId as string}
            roomName={roomName}
            roomDescription={roomDescription}
            members={members}
            currentUserId={currentUser?.userId || ''}
            isCreator={isCreator}
            isGroupAdmin={isGroupAdmin}
            onClose={handleCloseBottomSheet}
            onRefresh={handleRefresh}
          />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  sheetContent: {
    flex: 1,
    paddingTop: 8,
  },
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