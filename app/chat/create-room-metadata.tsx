// app/chat/create-room-metadata.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { createChatRoom } from '@/api/chat';
import CustomInput from '@/components/ui/CustomInput';
import CustomButton from '@/components/ui/CustomButton';
import { Ionicons } from '@expo/vector-icons';

export default function CreateRoomMetadata() {
  const { selectedUserIds } = useLocalSearchParams();
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({ name: false });
  const userIdArray = (selectedUserIds as string).split(',').filter(id => id.trim() !== '');
  const othersCount = userIdArray.length - 1; // excluding self

// app/chat/create-room-metadata.tsx - Updated handleCreateRoom function
const handleCreateRoom = async () => {
  if (!roomName.trim()) {
    setTouched({ name: true });
    return;
  }

  try {
    setIsLoading(true);
    
    // Parse the user IDs from the URL params
    const userIdArray = (selectedUserIds as string).split(',').filter(id => id.trim() !== '');
    
    if (userIdArray.length === 0) {
      alert('No users selected. Please go back and select users.');
      setIsLoading(false);
      return;
    }

    console.log("Creating room with users:", userIdArray);

    const newRoom = await createChatRoom(
      {
        roomName: roomName,
        roomDescription: roomDescription || undefined,
        isGroup: true
      }, 
      userIdArray
    );

    // Navigate to chat rooms
    router.replace('/(drawer)');
  } catch (error) {
    console.error('Error creating room:', error);
    alert('Failed to create chat room. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <View className="bg-white rounded-lg p-4 shadow-sm mb-4">
          <Text className="text-lg font-bold mb-1">Room Details</Text>
          <Text className="text-gray-500 mb-4">
            Provide a name and optional description for your chat room.
          </Text>

          <CustomInput
            label="Room Name"
            value={roomName}
            onChangeText={setRoomName}
            placeholder="Enter room name"
            containerClassName="mb-4"
            leftIcon={<Ionicons name="chatbubbles-outline" size={20} color="#6B7280" />}
            error={!roomName.trim() && touched.name ? "Room name is required" : ""}
            touched={touched.name}
            onBlur={() => setTouched({ name: true })}
          />

          <CustomInput
            label="Room Description (Optional)"
            value={roomDescription}
            onChangeText={setRoomDescription}
            placeholder="Enter room description"
            containerClassName="mb-4"
            leftIcon={<Ionicons name="information-circle-outline" size={20} color="#6B7280" />}
            multiline
            numberOfLines={3}
          />
        </View>

        <View className="bg-white rounded-lg p-4 shadow-sm mb-4">
          <Text className="text-lg font-bold mb-1">Selected Users</Text>
          <Text className="text-gray-500 mb-2">
            You + {othersCount} other{othersCount !== 1 ? 's' : ''} ({userIdArray.length} total)
          </Text>
        </View>

        <CustomButton
          title="Create Room"
          onPress={handleCreateRoom}
          disabled={!roomName.trim() || isLoading}
          loading={isLoading}
          bgVariant="primary"
          className="mt-4"
          IconRight={() => <Ionicons name="checkmark-circle" size={20} color="white" />}
        />

        <TouchableOpacity 
          className="mt-4 p-2 flex-row justify-center items-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color="#6B7280" />
          <Text className="text-gray-500 ml-1">Back to user selection</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}