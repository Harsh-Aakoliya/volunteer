// app/chat/room-settings.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Switch,
  Alert
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import CustomInput from '@/components/ui/CustomInput';
import CustomButton from '@/components/ui/CustomButton';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export default function RoomSettings() {
  const { roomId } = useLocalSearchParams();
  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false); // Add group admin check
  const [loadingToggle, setLoadingToggle] = useState<string | null>(null);
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null);

  console.log("here in room setting page",roomId);
// Inside your component, add this effect
useFocusEffect(
  useCallback(() => {
    // This will run when the screen comes into focus
    if (roomId) {
      loadRoomSettings();
    }
    return () => {
      // Optional cleanup
    };
  }, [roomId])
);

// useEffect(() => {
//   if (roomId) {
//     loadRoomSettings();
//   }
// }, [roomId]);

// Make sure your loadRoomSettings function is defined outside of useEffect
const loadRoomSettings = async () => {
  try {
    setIsLoading(true);
    
    // Get current user
    const userData = await AuthStorage.getUser();
    setCurrentUser(userData);
    
    // Fetch room details
    const token = await AuthStorage.getToken();
    const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` }
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
    
    // If user is not group admin, redirect them back
    if (!isUserGroupAdmin) {
      Alert.alert(
        'Access Denied',
        'Only group admins can access room settings.',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
      return;
    }
    
  } catch (error) {
    console.error('Error loading room settings:', error);
    alert('Failed to load room settings');
    router.back();
  } finally {
    setIsLoading(false);
  }
};
  const updateRoomSettings = async () => {
    if (!roomName.trim()) return;
    
    try {
      const token = await AuthStorage.getToken();
      await axios.put(
        `${API_URL}/api/chat/rooms/${roomId}`,
        { roomName, roomDescription },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Room settings updated successfully');
      router.back();
    } catch (error) {
      console.error('Error updating room settings:', error);
      alert('Failed to update room settings');
    }
  };

  const toggleMemberAdmin = async (memberId: string, isCurrentlyAdmin: boolean) => {
    try {
      setLoadingToggle(memberId);
      const token = await AuthStorage.getToken();
      await axios.put(
        `${API_URL}/api/chat/rooms/${roomId}/members/${memberId}`,
        { isAdmin: !isCurrentlyAdmin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      setMembers(prev => 
        prev.map(member => 
          member.userId === memberId 
            ? { ...member, isAdmin: !isCurrentlyAdmin } 
            : member
        )
      );
    } catch (error) {
      console.error('Error updating member permissions:', error);
      alert('Failed to update member permissions');
    } finally {
      setLoadingToggle(null);
    }
  };

  const removeMember = async (memberId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the room?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingDelete(memberId);
              const token = await AuthStorage.getToken();
              await axios.delete(
                `${API_URL}/api/chat/rooms/${roomId}/members/${memberId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              // Update local state
              setMembers(prev => prev.filter(member => member.userId !== memberId));
            } catch (error) {
              console.error('Error removing member:', error);
              alert('Failed to remove member');
            } finally {
              setLoadingDelete(null);
            }
          }
        }
      ]
    );
  };

  const renderMemberItem = ({ item }: { item: any }) => {
    const isCurrentUser = item.userId === currentUser?.userId;
    
    return (
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center">
          <View className="w-10 h-10 bg-blue-100 rounded-full justify-center items-center mr-3">
            <Text className="text-blue-500 font-bold">
              {(item.fullName || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text className="text-lg font-bold">
              {item.fullName || 'Unknown User'} {isCurrentUser ? '(You)' : ''}
            </Text>
            <Text className="text-gray-500">{item.isAdmin ? 'Admin' : 'Member'}</Text>
          </View>
        </View>
        
        {!isCurrentUser && (
          <View className="flex-row items-center">
            {loadingToggle === item.userId ? (
              <ActivityIndicator size="small" color="#0284c7" className="mr-4" />
            ) : (
              <Switch
                value={item.isAdmin}
                onValueChange={() => toggleMemberAdmin(item.userId, item.isAdmin)}
                trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                thumbColor={item.isAdmin ? "#0284c7" : "#f4f3f4"}
                disabled={loadingToggle === item.userId}
              />
            )}
            <TouchableOpacity 
              className="ml-4"
              onPress={() => removeMember(item.userId)}
              disabled={loadingDelete === item.userId}
            >
              {loadingDelete === item.userId ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  // Show access denied message if not group admin
  if (!isGroupAdmin) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Ionicons name="lock-closed-outline" size={60} color="#d1d5db" />
        <Text className="text-gray-500 mt-4 text-center text-lg font-semibold">
          Access Denied
        </Text>
        <Text className="text-gray-400 mt-2 text-center">
          Only group admins can access room settings
        </Text>
        <TouchableOpacity
          className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const handleDeleteRoom = () => {
    Alert.alert(
      'Delete Room',
      'Are you sure you want to delete this room? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AuthStorage.getToken();
              await axios.delete(
                `${API_URL}/api/chat/rooms/${roomId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              alert('Room deleted successfully');
              router.replace('/chat');
            } catch (error) {
              console.error('Error deleting room:', error);
              alert('Failed to delete room');
            }
          }
        }
      ]
    );
  };
  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white mb-4">
        {/* <Text className="text-xl font-bold mb-4">Room Settings</Text> */}
        
        <CustomInput
          label="Room Name"
          value={roomName}
          onChangeText={setRoomName}
          containerClassName="mb-4"
        />
        
        <CustomInput
          label="Room Description (Optional)"
          value={roomDescription}
          onChangeText={setRoomDescription}
          multiline
          numberOfLines={3}
          containerClassName="mb-4"
        />
        
        <CustomButton
          title="Save Changes"
          onPress={updateRoomSettings}
          disabled={!roomName.trim()}
          bgVariant="primary"
          className="mt-2"
        />
      </View>
      
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-2 bg-gray-100">
          <Text className="text-lg font-bold">Members ({members.length})</Text>
          <TouchableOpacity
            onPress={() => router.push(`/chat/add-members?roomId=${roomId}`)}
            className="bg-blue-500 px-3 py-1 rounded-lg"
          >
            <Text className="text-white text-sm font-medium">Add Members</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={members}
          keyExtractor={(item) => item.userId}
          renderItem={renderMemberItem}
          ListEmptyComponent={
            <View className="p-4 items-center">
              <Text className="text-gray-500">No members found</Text>
            </View>
          }
        />
      </View>
      
      <View className="p-4 bg-white border-t border-gray-200">
        {roomDetails?.isCreator && (
          <CustomButton
            title="Delete Room"
            onPress={handleDeleteRoom}
            bgVariant="danger"
          />
        )}
      </View>
    </View>
  );
}
