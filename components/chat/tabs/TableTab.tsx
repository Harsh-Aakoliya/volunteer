// components/chat/tabs/MediaTab.tsx
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function TableTab({ roomId, userId }: any) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: "/chat/MediaUploader",
          params: { roomId, userId },
        })
      }
      className="p-4 bg-gray-100 rounded-xl"
    >
      <Text className="text-center font-medium">Open Media Picker</Text>
    </TouchableOpacity>
  );
}
