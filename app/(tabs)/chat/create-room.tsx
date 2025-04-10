// app/chat/create-room.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { router } from 'expo-router';
import { fetchChatUsers } from '@/api/chat';
import { ChatUser } from '@/types/type';
import Checkbox from 'expo-checkbox';
import CustomButton from '@/components/ui/CustomButton';
import { AuthStorage } from '@/utils/authStorage';

export default function CreateRoomUserSelection() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [currentUser,setCurrentUser]=useState<any>(null);
  useEffect(()=>{
    const featchCurrentLoggedUser = async ()=>{
        try {
            const curretnUserData=await AuthStorage.getUser();
            console.log("Current user is ",curretnUserData)
            setCurrentUser(curretnUserData);
        } catch (error) {
            console.log("You are not logged in ");
        }
    }
    featchCurrentLoggedUser();
  },[]);
  useEffect(() => {
    const loadChatUsers = async () => {
      try {
        const fetchedUsers = await fetchChatUsers();
        setUsers(fetchedUsers);
      } catch (error) {
        console.error('Error loading chat users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatUsers();
  }, []);

  const toggleUserSelection = (userId: number) => {
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

  const renderUserItem = ({ item }: { item: ChatUser }) => (
    <TouchableOpacity 
      className="flex-row items-center p-4 bg-white border-b border-gray-200"
      onPress={() => toggleUserSelection(item.id)}
    >
      <Checkbox
        value={selectedUsers.has(item.id)}
        onValueChange={() => toggleUserSelection(item.id)}
        className="mr-4"
      />
      <View>
        <Text className="text-lg font-bold">{item.full_name}</Text>
        <Text className="text-gray-500">{item.mobile_number}</Text>
      </View>
    </TouchableOpacity>
  );

  const handleNextStep = () => {
    selectedUsers.add(currentUser.specific_id);
    if (selectedUsers.size > 0) {
      router.push({
        pathname: '/chat/create-room-metadata',
        params: { 
          selectedUserIds: Array.from(selectedUsers).join(',') 
        }
      });
    }
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
      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderUserItem}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-4">
            <Text className="text-gray-500">No users available</Text>
          </View>
        }
      />

      <View className="p-4">
        <CustomButton
          title={`Next (${selectedUsers.size} selected)`}
          onPress={handleNextStep}
          disabled={selectedUsers.size === 0}
          bgVariant="primary"
        />
      </View>
    </View>
  );
}