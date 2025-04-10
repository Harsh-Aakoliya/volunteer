// app/chat/create-room-metadata.tsx
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { createChatRoom } from '@/api/chat';
import CustomInput from '@/components/ui/CustomInput';
import CustomButton from '@/components/ui/CustomButton';

export default function CreateRoomMetadata() {
  const { selectedUserIds } = useLocalSearchParams();
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;

    try {
      setIsLoading(true);
      const userIds = (selectedUserIds as string)
        .split(',')
        .map(id => parseInt(id, 10));

      const newRoom = await createChatRoom(
        {
          room_name: roomName,
          room_description: roomDescription || undefined,
          is_group: true
        }, 
        userIds
      );

      // Navigate to chat rooms or specific chat room
      router.replace('/chat');
    } catch (error) {
      console.error('Error creating room:', error);
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Text className="text-2xl font-bold mb-4">Create Chat Room</Text>
      
      <CustomInput
        label="Room Name"
        value={roomName}
        onChangeText={setRoomName}
        placeholder="Enter room name"
        containerClassName="mb-4"
      />

      <CustomInput
        label="Room Description (Optional)"
        value={roomDescription}
        onChangeText={setRoomDescription}
        placeholder="Enter room description"
        containerClassName="mb-4"
        multiline
      />

      <CustomButton
        title="Create Room"
        onPress={handleCreateRoom}
        disabled={!roomName.trim() || isLoading}
        loading={isLoading}
        bgVariant="primary"
        className="mt-4"
      />
    </View>
  );
}