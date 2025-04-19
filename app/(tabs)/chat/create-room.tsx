// app/chat/create-room.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput
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
  const [filteredUsers, setFilteredUsers] = useState<ChatUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
console.log("all users",users);
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
    const loadChatUsers = async () => {
      try {
        const fetchedUsers = await fetchChatUsers();//{userId, fullName, mobileNumber}
        setUsers(fetchedUsers);
        setFilteredUsers(fetchedUsers);
      } catch (error) {
        console.error('Error loading chat users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        (user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (user.mobileNumber?.includes(searchQuery) || false)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

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

  const renderUserItem = ({ item }: { item: ChatUser }) => {
    // Get the first letter of the name or use a default
    console.log("here in renderuseritemp",item);
    const firstLetter = item.fullName ? item.fullName.charAt(0).toUpperCase() : '?';
    const displayName = item.fullName || 'Unknown User';
    return (
      <TouchableOpacity 
        className="flex-row items-center p-4 bg-white border-b border-gray-200"
        onPress={() => toggleUserSelection(item.userId)}
      >
        <Checkbox
          value={selectedUsers.has(item.userId)}
          onValueChange={() => toggleUserSelection(item.userId)}
          className="mr-4"
          color={selectedUsers.has(item.userId) ? '#0284c7' : undefined}
        />
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 bg-blue-100 rounded-full justify-center items-center mr-3">
            <Text className="text-blue-500 font-bold">
              {firstLetter}
            </Text>
          </View>
          <View>
            <Text className="text-lg font-bold">{displayName}</Text>
            <Text className="text-gray-500">{item.mobileNumber || 'No phone number'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

// app/chat/create-room.tsx - Updated handleNextStep function
const handleNextStep = () => {
  if (selectedUsers.size === 0) {
    alert("Please select at least one user");
    return;
  }
  
  // Convert the Set to an array of valid user IDs
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
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            className="flex-1 ml-2 text-base"
            placeholder="Search users..."
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
          <View className="flex-1 justify-center items-center p-4 mt-10">
            <Ionicons name="people-outline" size={60} color="#d1d5db" />
            <Text className="text-gray-500 mt-4 text-center">
              {searchQuery.length > 0 
                ? "No users match your search" 
                : "No users available"}
            </Text>
          </View>
        }
      />

      <View className="p-4 bg-white border-t border-gray-200">
        <CustomButton
          title={`Next (${selectedUsers.size} selected)`}
          onPress={handleNextStep}
          disabled={selectedUsers.size === 0}
          bgVariant="primary"
          IconRight={() => <Ionicons name="arrow-forward" size={20} color="white" />}
        />
      </View>
    </View>
  );
}