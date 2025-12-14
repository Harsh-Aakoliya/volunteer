import React from "react";
import {
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatISTDate } from "@/utils/dateUtils";

type ScheduledMessage = {
  senderName: string;
  messageText: string;
  createdAt: string;
};

type ScheduledMessagesModalProps = {
  visible: boolean;
  onClose: () => void;
  messages: ScheduledMessage[];
  onRefresh: () => void;
};

export default function ScheduledMessagesModal({
  visible,
  onClose,
  messages,
  onRefresh,
}: ScheduledMessagesModalProps) {
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
            Scheduled Messages
          </Text>

          <TouchableOpacity onPress={onRefresh} className="p-2">
            <Ionicons name="refresh" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {messages.length === 0 ? (
            <View className="flex-1 justify-center items-center py-8">
              <Ionicons name="time-outline" size={60} color="#d1d5db" />
              <Text className="text-gray-500 mt-4 text-center">
                No scheduled messages
              </Text>
            </View>
          ) : (
            messages.map((message, index) => (
              <View key={index} className="mb-4 p-4 bg-gray-50 rounded-lg">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm text-gray-600">
                    {message.senderName}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {formatISTDate(message.createdAt)}
                  </Text>
                </View>
                <Text className="text-base text-gray-900 mb-2">
                  {message.messageText}
                </Text>
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={16} color="#6b7280" />
                  <Text className="text-sm text-gray-600 ml-1">
                    Scheduled for {formatISTDate(message.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
