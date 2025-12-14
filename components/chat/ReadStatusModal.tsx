import React from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatISTDate } from "@/utils/dateUtils";
import { Message } from "@/types/type";

type ReadStatusModalProps = {
  visible: boolean;
  onClose: () => void;
  isLoading: boolean;
  data: {
    readBy: Array<{ userId: string; fullName: string; readAt: string }>;
    unreadBy: Array<{ userId: string; fullName: string }>;
  } | null;
  selectedMessage: Message | null;
  onRefresh: () => void;
};

export default function ReadStatusModal({
  visible,
  onClose,
  isLoading,
  data,
  selectedMessage,
  onRefresh,
}: ReadStatusModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>

          <Text className="text-lg font-semibold text-gray-900">
            Message Info
          </Text>

          <TouchableOpacity
            onPress={onRefresh}
            disabled={isLoading}
            className="p-2"
          >
            <Ionicons
              name="refresh"
              size={24}
              color={isLoading ? "#9ca3af" : "#374151"}
            />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {selectedMessage && (
            <View className="mb-6 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600 mb-2">
                {selectedMessage.senderName} •{" "}
                {formatISTDate(selectedMessage.createdAt)}
              </Text>
              <Text className="text-base text-gray-900" numberOfLines={3}>
                {selectedMessage.messageText}
              </Text>
            </View>
          )}

          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#0284c7" />
              <Text className="text-gray-500 mt-2">Loading read status...</Text>
            </View>
          ) : data ? (
            <View>
              {data.readBy.length > 0 && (
                <View className="mb-6">
                  <Text className="text-lg font-semibold text-gray-900 mb-3">
                    Read by ({data.readBy.length})
                  </Text>
                  {data.readBy.map((user, index) => (
                    <View
                      key={index}
                      className="flex-row items-center justify-between py-2 border-b border-gray-100"
                    >
                      <Text className="text-gray-900">{user.fullName}</Text>
                      <Text className="text-sm text-gray-500">
                        {formatISTDate(user.readAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {data.unreadBy.length > 0 && (
                <View>
                  <Text className="text-lg font-semibold text-gray-900 mb-3">
                    Unread by ({data.unreadBy.length})
                  </Text>
                  {data.unreadBy.map((user, index) => (
                    <View
                      key={index}
                      className="flex-row items-center py-2 border-b border-gray-100"
                    >
                      <Text className="text-gray-500">{user.fullName}</Text>
                    </View>
                  ))}
                </View>
              )}

              {data.readBy.length === 0 && data.unreadBy.length === 0 && (
                <View className="items-center py-8">
                  <Ionicons
                    name="information-circle-outline"
                    size={48}
                    color="#d1d5db"
                  />
                  <Text className="text-gray-500 mt-2">
                    No read status available
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View className="items-center py-8">
              <Text className="text-gray-500">Failed to load read status</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
