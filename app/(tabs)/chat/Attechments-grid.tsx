import { View, Text, TouchableOpacity } from "react-native";
import SVGComponent from "../../../components/Icons/MdPermMedia";
import { Ionicons } from "@expo/vector-icons";
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
    <View className="flex flex-wrap flex-row">
      {/* Media (Images and Videos only) */}
      <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/MediaUploader", { roomId, userId, vmMedia: "true" })}>
          <SVGComponent color="black" height={60} width={60} />
          <Text className="text-center text-sm mt-2">Media</Text>
        </TouchableOpacity>
      </View>
      
      {/* Audio Recording */}
      <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={handleAudioPress}>
          <View className="w-15 h-15 bg-green-500 rounded-full items-center justify-center">
            <Ionicons name="mic" size={30} color="white" />
          </View>
          <Text className="text-center text-sm mt-2">Audio</Text>
        </TouchableOpacity>
      </View>
      
      {/* Poll */}
      <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/Polling", { roomId, userId })}>
          <SVGComponent color="black" height={60} width={60} />
          <Text className="text-center text-sm mt-2">Poll</Text>
        </TouchableOpacity>
      </View>
      
      {/* Table */}
      <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/table", { roomId, userId })}>
          <SVGComponent color="black" height={60} width={60} />
          <Text className="text-center text-sm mt-2">Table</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
