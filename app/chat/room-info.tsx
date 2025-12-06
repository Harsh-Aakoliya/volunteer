// app/chat/room-info.tsx
import React, { useState, useCallback, useMemo, useRef } from 'react';
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

// Bottom Sheet imports
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';

export default function RoomInfo() {
  const layout = useWindowDimensions();
  const { roomId } = useLocalSearchParams();
  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomName, setRoomName] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  // Bottom Sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Snap points for bottom sheet (percentage of screen height)
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

  // Load room info
  const loadRoomInfo = async () => {
    try {
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

      // Check if current user is group admin
      const isUserGroupAdmin = response.data.members.some(
        (member: any) => member.userId === userData?.userId && member.isAdmin
      );
      setIsGroupAdmin(isUserGroupAdmin);
      setIsCreator(response.data.isCreator || false);
    } catch (error) {
      console.error('Error loading room info:', error);
      alert('Failed to load room info');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        loadRoomInfo();
      }
      return () => {};
    }, [roomId])
  );

  // Render scene
  const renderScene = ({ route }: { route: { key: string } }) => {
    switch (route.key) {
      case 'members':
        return <MembersTab members={members} roomId={roomId as string} />;
      case 'announcements':
        return <AnnouncementsTab />;
      case 'media':
        return <MediaTab />;
      case 'poll':
        return <PollTab />;
      case 'table':
        return <TableTab />;
      default:
        return null;
    }
  };

  // Custom TabBar render
  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      indicatorStyle={{
        backgroundColor: '#3b82f6',
        height: 3,
        borderRadius: 1.5,
      }}
      style={{
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      }}
      tabStyle={{
        width: 'auto',
        paddingHorizontal: 16,
      }}
      labelStyle={{
        fontWeight: '600',
        fontSize: 13,
        textTransform: 'none',
      }}
      inactiveColor="#6b7280"
      activeColor="#3b82f6"
      scrollEnabled={true}
      bounces={true}
      pressColor="rgba(59, 130, 246, 0.1)"
      gap={8}
    />
  );

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
        {/* Drag Indicator */}
        <View style={styles.dragIndicator} />

        {/* Header */}
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
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        {/* Room Name */}
        <Text
          className="flex-1 text-lg font-semibold text-gray-900 mx-4"
          numberOfLines={1}
        >
          {roomName}
        </Text>

        {/* Menu Button - Only show for group admins */}
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
        lazyPreloadDistance={1}
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
            roomDescription={roomDetails?.roomDescription}
            members={members}
            currentUserId={currentUser?.userId || ''}
            isCreator={isCreator}
            isGroupAdmin={isGroupAdmin}
            onClose={handleCloseBottomSheet}
            onRefresh={loadRoomInfo}
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
});