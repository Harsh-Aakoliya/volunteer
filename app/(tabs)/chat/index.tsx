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
  console.log("is admin in chat room ",isAdmin);
  useEffect(() => {
    const loadChatRooms = async () => {
      try {
        const rooms = await fetchChatRooms();
        setChatRooms(rooms);
        console.log("Available rooms:", rooms);
        
        // Check admin status
        const adminStatus = await AuthStorage.getAdminStatus();
        console.log("checking admin status in index file of chat",adminStatus);
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
      <View className="flex-row items-center">
        <View className="w-10 h-10 bg-blue-100 rounded-full justify-center items-center mr-3">
          <Ionicons 
            name={item.isGroup ? "people" : "person"} 
            size={20} 
            color="#0284c7" 
          />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold">{item.roomName}</Text>
          {item.roomDescription && (
            <Text className="text-gray-500 text-sm">{item.roomDescription}</Text>
          )}
        </View>
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
      <FlatList
        data={chatRooms}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={renderChatRoomItem}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-4 mt-10">
            <Ionicons name="chatbubble-ellipses-outline" size={60} color="#d1d5db" />
            <Text className="text-gray-500 mt-4 text-center">
              No chat rooms available.
              {isAdmin ? " Create one by tapping the + button." : ""}
            </Text>
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