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
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import socketService from '@/utils/socketService';

export default function ChatRooms() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomsWithActivity, setRoomsWithActivity] = useState<{[key: string]: number}>({});
  
  // Connect to socket when component mounts
  useEffect(() => {
    const socket = socketService.connect();
    
    if (socket) {
      // Listen for online users updates for all rooms
      socket.on('onlineUsers', ({ roomId, onlineUsers }: { roomId: string, onlineUsers: string[] }) => {
        setRoomsWithActivity(prev => ({
          ...prev,
          [roomId]: onlineUsers.length
        }));
      });
      
      return () => {
        socket.off('onlineUsers');
      };
    }
    
    return () => {
      // Empty cleanup function if socket is null
    };
  }, []);
  
  useFocusEffect(
    useCallback(() => {
      loadChatRooms();
    }, [])
  );
  
  const loadChatRooms = async () => {
    try {
      const rooms = await fetchChatRooms();
      setChatRooms(rooms);
      
      // Check admin status
      const userData = await AuthStorage.getUser();
      const adminStatus = userData?.isAdmin || false;
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error loading chat rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
// app/chat/index.tsx - Remove the online users display from the chat list
const renderChatRoomItem = ({ item }: { item: ChatRoom }) => (
  <TouchableOpacity 
    className="bg-white p-4 border-b border-gray-200"
    onPress={() => {
      if (item.roomId !== undefined) {
        router.push({
          pathname: "/chat/[roomId]",
          params: { roomId: item.roomId.toString() }
        });
      } else {
        console.error('Chat room ID is undefined:', item);
        alert('Cannot open this chat room. ID is missing.');
      }
    }}
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
        keyExtractor={(item) => item.roomId?.toString() || Math.random().toString()}
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