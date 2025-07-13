import { View, Text, TouchableOpacity } from "react-native";
import SVGComponent from "../../../components/Icons/MdPermMedia";
import { useRouter } from "expo-router";
import React from "react";

interface AttachmentsGridProps {
  roomId: string;
  userId: string;
  onOptionSelect?: () => void;
}

export default function AttachmentsGrid({ roomId, userId, onOptionSelect }: AttachmentsGridProps) {
  const router = useRouter();

  const handleOptionPress = (pathname: string, params: any) => {
    // Call the callback to hide the grid
    onOptionSelect?.();
    
    // Navigate to the selected option
    router.push({
      pathname,
      params
    });
  };

  return (
    <View className="flex flex-wrap flex-row">
      {/* <View className="w-1/3 items-center justify-center">
      <TouchableOpacity onPress={() => handleOptionPress("/chat/MediaUploader", { roomId, userId })}>
          <SVGComponent color="black" height={60} width={60} />
          <Text>Multimedia</Text>
      </TouchableOpacity>
      </View> */}
      
      <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/MediaUploader", { roomId, userId, vmMedia: "true" })}>
          <SVGComponent color="black" height={60} width={60} />
          <Text className="text-center text-sm mt-2">VM Media</Text>
        </TouchableOpacity>
      </View>
      
      <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/Polling", { roomId, userId })}>
          <SVGComponent color="black" height={60} width={60} />
          <Text className="text-center text-sm mt-2">Poll</Text>
        </TouchableOpacity>
      </View>
      
      {/* <View className="w-1/3 items-center justify-center">
          <SVGComponent color="black" height={60} width={60} />
          <Text>Document</Text>
      </View> */}
      
      <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={() => handleOptionPress("/chat/table", { roomId, userId })}>
          <SVGComponent color="black" height={60} width={60} />
          <Text className="text-center text-sm mt-2">Table</Text>
        </TouchableOpacity>
      </View>
      
      {/* <View className="w-1/3 items-center justify-center">
          <SVGComponent color="black" height={60} width={60} />
          <Text>Contact</Text>
      </View>
      <View className="w-1/3 items-center justify-center">
          <SVGComponent color="black" height={60} width={60} />
          <Text>Temp</Text>
      </View> */}
    </View>
  );
}
