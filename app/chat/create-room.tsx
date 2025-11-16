// app/chat/create-room.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { fetchChatUsers } from '@/api/chat';
import { ChatUser } from '@/types/type';
import Checkbox from 'expo-checkbox';
import CustomButton from '@/components/ui/CustomButton';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage } from '@/utils/authStorage';

export default function CreateRoomUserSelection() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchCurrentLoggedUser = async () => {
      try {
        const currentUserData = await AuthStorage.getUser();
        console.log("Current user is:", currentUserData);
        setCurrentUser(currentUserData);
      } catch (error) {
        console.log("Error fetching current user:", error);
      }
    };
    fetchCurrentLoggedUser();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all users
        const allUsers = await fetchChatUsers();
        console.log("All users fetched:", allUsers);
        
        // Filter out current user from the list
        const filteredUsers = allUsers.filter(
          (user: ChatUser) => user.userId !== currentUser?.userId
        );
        
        setUsers(filteredUsers);
        console.log("Users after filtering current user:", filteredUsers);
        
      } catch (error) {
        console.error('Error loading users:', error);
        alert('Failed to load users: ' + (error as any).message);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

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

  const renderUserItem = ({ item: user }: { item: ChatUser }) => {
    const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : '?';
    const displayName = user.fullName || 'Unknown User';
    const isSelected = selectedUsers.has(user.userId);

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

  const handleNextStep = () => {
    if (selectedUsers.size === 0) {
      alert("Please select at least one user");
      return;
    }
  
    // Convert the Set to an array of valid user IDs and add current user
    const selectedUserArray = Array.from(selectedUsers).filter(id => id && id.trim() !== '');
    selectedUserArray.push(currentUser.userId);
    
    if (selectedUserArray.length === 0) {
      alert("No valid users selected");
      return;
    }
    
    router.push({
      pathname: '/chat/create-room-metadata',
      params: { 
        selectedUserIds: selectedUserArray.join(',') 
      }
    });
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
        <Text className="text-xl font-bold mb-2">Select Users</Text>
        <Text className="text-gray-600 mb-4">
          Choose users to add to your chat room
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
                : 'No users available'}
            </Text>
          </View>
        }
        className="flex-1"
      />

      <View className="p-4 bg-white border-t border-gray-200">
        <Text className="text-center mb-3 text-gray-600">
          You + {selectedUsers.size} other{selectedUsers.size !== 1 ? 's' : ''} ({selectedUsers.size + 1} total)
        </Text>
        <CustomButton
          title="Next Step"
          onPress={handleNextStep}
          disabled={selectedUsers.size === 0}
          bgVariant="primary"
          IconRight={() => <Ionicons name="arrow-forward" size={20} color="white" />}
        />
      </View>
    </View>
  );
}
