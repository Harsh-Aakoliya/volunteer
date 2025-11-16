// app/chat/add-members.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import CustomButton from '@/components/ui/CustomButton';
import Checkbox from 'expo-checkbox';
import { fetchChatUsers } from '@/api/chat';
import { ChatUser } from '@/types/type';

export default function AddMembers() {
  const { roomId } = useLocalSearchParams();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [existingMembers, setExistingMembers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  console.log("Here in add members page", roomId);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userData = await AuthStorage.getUser();
        setCurrentUser(userData);
        console.log("userData in add members page", userData);
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        const token = await AuthStorage.getToken();
        
        // Get existing room members
        const roomResponse = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        console.log("room response", roomResponse.data);
        
        const memberIds = roomResponse.data.members.map((member: any) => member.userId);
        setExistingMembers(memberIds);
        
        // Fetch all users
        const allUsers = await fetchChatUsers();
        console.log("All users fetched:", allUsers);
        
        // Filter out users who are already members
        const availableUsers = allUsers.filter(
          (user: ChatUser) => !memberIds.includes(user.userId)
        );
        
        setUsers(availableUsers);
        console.log("Available users after filtering existing members:", availableUsers);
        
      } catch (error) { 
        console.error('Error loading users:', error);
        alert('Failed to load users: ' + (error as any).message);
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId && currentUser) {
      loadUsers();
    }
  }, [roomId, currentUser]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      return newSelected;
    });
  };

  const addMembersToRoom = async () => {
    if (selectedUsers.size === 0) return;
    
    try {
      const selectedUserArray = Array.from(selectedUsers);
      console.log("Adding members:", selectedUserArray);
      const token = await AuthStorage.getToken();
      await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/members`,
        { userIds: selectedUserArray },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Members added successfully');
      router.back();
    } catch (error) {
      console.error('Error adding members:', error);
      alert('Failed to add members: ' + (error as any).message);
    }
  };

  const renderUserItem = ({ item: user }: { item: ChatUser }) => {
    const isSelected = selectedUsers.has(user.userId);
    const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : '?';
    const displayName = user.fullName || 'Unknown User';

    return (
      <TouchableOpacity 
        className={`flex-row items-center p-4 border-b border-gray-100 ${
          isSelected ? 'bg-blue-50' : 'bg-white'
        }`}
        onPress={() => toggleUserSelection(user.userId)}
      >
        <Checkbox
          value={isSelected}
          onValueChange={() => toggleUserSelection(user.userId)}
          className="mr-3"
          color={isSelected ? '#0284c7' : undefined}
        />
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 bg-blue-100 rounded-full justify-center items-center mr-3">
            <Text className="text-blue-500 font-bold text-base">
              {firstLetter}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-800">{displayName}</Text>
            <Text className="text-gray-400 text-sm">{user.mobileNumber || ''}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Filter users based on search query
  const filteredUsers = users.filter(user => 
    searchQuery === '' || 
    user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.mobileNumber?.includes(searchQuery)
  );

  if (isLoading || !currentUser) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-gray-500 mt-2">Loading users...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200">
        <Text className="text-xl font-bold mb-2">Add Members</Text>
        <Text className="text-gray-600 mb-4">
          Select users to add to this chat room
        </Text>
        
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            className="flex-1 ml-2 text-base"
            placeholder="Search users by name or mobile..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.userId}
        renderItem={renderUserItem}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-gray-500">
              {searchQuery 
                ? 'No users found matching your search'
                : 'No users available to add'}
            </Text>
          </View>
        }
        className="flex-1"
      />

      <View className="p-4 bg-white border-t border-gray-200">
        <Text className="text-center mb-3 text-gray-600">
          {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
        </Text>
        <CustomButton
          title="Add Selected Members"
          onPress={addMembersToRoom}
          disabled={selectedUsers.size === 0}
          bgVariant="primary"
        />
      </View>
    </View>
  );
}
