import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import React from "react";

interface AttachmentsGridProps {
  roomId: string;
  userId: string;
  onOptionSelect?: () => void;
  onAudioRecord?: () => void;
}

export default function AttachmentsGrid({ roomId, userId, onOptionSelect, onAudioRecord }: AttachmentsGridProps) {
  const router = useRouter();

  const handleOptionPress = (pathname: string, params: any) => {
    // Call the callback to hide the grid
    onOptionSelect?.();
    
    // Navigate to the selected option
    router.push({
      pathname: pathname as any,
      params
    });
  };

  const handleAudioPress = () => {
    onOptionSelect?.();
    onAudioRecord?.();
  };

  return (
    <View className="flex flex-row">
      {/* Media (Images and Videos only) */}
      <View className="w-1/4 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/MediaUploader", { roomId, userId, vmMedia: "true" })}>
          <Image 
            source={require('@/assets/images/media.png')} 
            style={{ width: 60, height: 60 }}
            resizeMode="contain"
          />
          {/* <Text className="text-center text-sm mt-2">Media</Text> */}
        </TouchableOpacity>
      </View>
      
      {/* Poll */}
      <View className="w-1/4 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/Polling", { roomId, userId })}>
          <Image 
            source={require('@/assets/images/poll.png')} 
            style={{ width: 60, height: 60 }}
            resizeMode="contain"
          />
          {/* <Text className="text-center text-sm mt-2">Poll</Text> */}
        </TouchableOpacity>
      </View>
      
      {/* Table */}
      <View className="w-1/4 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/table", { roomId, userId })}>
          <Image 
            source={require('@/assets/images/table.png')} 
            style={{ width: 60, height: 60 }}
            resizeMode="contain"
          />
          {/* <Text className="text-center text-sm mt-2">Table</Text> */}
        </TouchableOpacity>
      </View>
      
      {/* Announcement */}
      <View className="w-1/4 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/create-chat-announcement", { roomId, userId })}>
          <Image 
            source={require('@/assets/images/announcement.png')} 
            style={{ width: 80, height: 80 }}
            resizeMode="contain"
          />
          {/* <Text className="text-center text-sm mt-2">Announ</Text> */}
        </TouchableOpacity>
      </View>
    </View>
  );
}
