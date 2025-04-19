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

export default function AddMembers() {
  const { roomId } = useLocalSearchParams();
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [existingMembers, setExistingMembers] = useState<string[]>([]);

  console.log("Here in add members page", roomId);

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
        
        // Get all users - FIXED: Use the correct endpoint
        const usersResponse = await axios.get(`${API_URL}/api/chat/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("Users fetched:", usersResponse.data.length);
        
        // Filter out users who are already members
        const availableUsers = usersResponse.data.filter(
          (user: any) => !memberIds.includes(user.userId)
        );
        
        console.log("Available users to add:", availableUsers.length);
        setUsers(availableUsers);
        setFilteredUsers(availableUsers);
      } catch (error) {
        console.error('Error loading users:', error);
        alert('Failed to load users: ' + (error as any).message);
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) {
      loadUsers();
    }
  }, [roomId]);

  useEffect(() => {
    // Filter users based on search query
    if (searchQuery) {
      const filtered = users.filter(user => 
        (user.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (user.mobileNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const addMembersToRoom = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      console.log("Adding members:", selectedUsers);
      const token = await AuthStorage.getToken();
      await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/members`,
        { userIds: selectedUsers },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Members added successfully');
      router.back();
    } catch (error) {
      console.error('Error adding members:', error);
      alert('Failed to add members: ' + (error as any).message);
    }
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      className={`flex-row items-center justify-between p-4 border-b border-gray-200 ${
        selectedUsers.includes(item.userId) ? 'bg-blue-50' : 'bg-white'
      }`}
      onPress={() => toggleUserSelection(item.userId)}
    >
      <View className="flex-row items-center">
        <View className="w-10 h-10 bg-blue-100 rounded-full justify-center items-center mr-3">
          <Text className="text-blue-500 font-bold">
            {(item.fullName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text className="text-lg font-bold">{item.fullName || 'Unknown User'}</Text>
          <Text className="text-gray-500">{item.mobileNumber || ''}</Text>
        </View>
      </View>
      
      <View>
        {selectedUsers.includes(item.userId) ? (
          <Ionicons name="checkmark-circle" size={24} color="#0284c7" />
        ) : (
          <Ionicons name="add-circle-outline" size={24} color="#9ca3af" />
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white">
        <Text className="text-xl font-bold mb-4">Add Members</Text>
        
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 mb-4">
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            className="flex-1 py-2 px-3"
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.userId}
        renderItem={renderUserItem}
        ListEmptyComponent={
          <View className="p-4 items-center">
            <Text className="text-gray-500">
              {searchQuery 
                ? 'No users found matching your search' 
                : 'No users available to add'}
            </Text>
          </View>
        }
      />
      
      <View className="p-4 bg-white border-t border-gray-200">
        <Text className="text-center mb-3 text-gray-600">
          {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
        </Text>
        <CustomButton
          title="Add Selected Members"
          onPress={addMembersToRoom}
          disabled={selectedUsers.length === 0}
          bgVariant="primary"
        />
      </View>
    </View>
  );
}