import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message } from "@/types/type";

type ReplyPreviewProps = {
  message: Message;
  onCancel: () => void;
};

export default function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  return (
    <View className="bg-gray-100 border-t border-gray-200 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Ionicons name="arrow-undo" size={16} color="#6b7280" />
            <Text className="text-sm text-gray-600 ml-2">
              Replying to {message.senderName}
            </Text>
          </View>
          <Text
            className="text-sm text-gray-800 bg-white px-3 py-2 rounded-lg"
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {message.messageText}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} className="ml-3 p-2">
          <Ionicons name="close" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
