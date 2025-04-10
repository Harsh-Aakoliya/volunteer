// app/chat/index.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { fetchChatRooms } from '@/api/chat';
import { AuthStorage } from '@/utils/authStorage';
import { ChatRoom } from '@/types/type';

export default function ChatRooms() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadChatRooms = async () => {
      try {
        const rooms = await fetchChatRooms();
        setChatRooms(rooms);
        console.log("available rooms",rooms);
        // Check admin status
        const adminStatus = await AuthStorage.getAdminStatus();
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Error loading chat rooms:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatRooms();
  }, []);

  const renderChatRoomItem = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity 
      className="bg-white p-4 border-b border-gray-200"
      // onPress={() => router.push(`/chat/${item.id}`)}
    >
      <Text className="text-lg font-bold">{item.room_name}</Text>
      {item.room_description && (
        <Text className="text-gray-500">{item.room_description}</Text>
      )}
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
      <FlatList
        data={chatRooms}
        keyExtractor={(item) => item.id?.toString() || ''}
        renderItem={renderChatRoomItem}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-4">
            <Text className="text-gray-500">No chat rooms available</Text>
          </View>
        }
      />

      {isAdmin && (
        <TouchableOpacity
          className="absolute bottom-6 right-6 bg-blue-500 p-4 rounded-full shadow-lg"
          onPress={() => router.push('/chat/create-room')}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}