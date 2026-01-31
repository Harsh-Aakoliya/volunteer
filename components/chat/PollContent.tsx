// components/chat/PollContent.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import axios from "axios";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";

type PollOption = {
  id: string;
  text: string;
};

interface PollContentProps {
  roomId: string;
  userId: string;
  onSuccess: () => void;
  onBack: () => void;
  isDark?: boolean;
  showInSheet?: boolean;
  isHalfScreen?: boolean;
}

export default function PollContent({
  roomId,
  userId,
  onSuccess,
  onBack,
  isDark = false,
  showInSheet = false,
  isHalfScreen = false,
}: PollContentProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<PollOption[]>([
    { id: "1", text: "" },
    { id: "2", text: "" },
  ]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [sending, setSending] = useState(false);
  const { sendMessage: socketSendMessage } = useSocket();

  const validOptions = options.filter((opt) => opt.text.trim() !== "");
  const isCreateEnabled = question.trim() !== "" && validOptions.length >= 2;

  const addOption = () => {
    if (options.length < 12) {
      setOptions([...options, { id: `${Date.now()}`, text: "" }]);
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 1) {
      setOptions(options.filter((opt) => opt.id !== id));
    }
  };

  const updateOption = (id: string, text: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, text } : opt)));
  };

  const sendPoll = async () => {
    if (sending || !isCreateEnabled) return;
    Keyboard.dismiss();
    setSending(true);

    try {
      const response = await axios.post(`${API_URL}/api/poll`, {
        question,
        options: validOptions,
        isMultipleChoiceAllowed: multipleChoice,
        pollEndTime: null,
        roomId,
        createdBy: userId,
      });

      const createdPollId = response.data.poll.id;
      const token = await AuthStorage.getToken();

      const pollResponse = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        {
          messageText: "",
          messageType: "poll",
          pollId: createdPollId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      socketSendMessage(roomId, {
        id: pollResponse.data.id,
        messageText: "",
        createdAt: pollResponse.data.createdAt,
        messageType: "poll",
        mediaFilesId: 0,
        pollId: pollResponse.data.pollId,
        tableId: 0,
        replyMessageId: 0,
      });

      onSuccess();
    } catch (error) {
      console.error("Error creating poll:", error);
      Alert.alert("Error", "Failed to create poll. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View className={`flex-1 ${isDark ? "bg-[#0E1621]" : "bg-white"}`}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-40"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with Create button */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className={`text-sm font-medium ${isDark ? "text-blue-400" : "text-blue-500"}`}>
            Poll question
          </Text>
          <TouchableOpacity
            onPress={sendPoll}
            disabled={!isCreateEnabled || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={isDark ? "#60a5fa" : "#3b82f6"} />
            ) : (
              <Text
                className={`text-sm font-semibold ${
                  isCreateEnabled
                    ? isDark
                      ? "text-blue-400"
                      : "text-blue-500"
                    : isDark
                    ? "text-gray-600"
                    : "text-gray-400"
                }`}
              >
                CREATE
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Question Input */}
        <TextInput
          placeholder="Ask a question"
          placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
          value={question}
          onChangeText={setQuestion}
          className={`text-base py-3 mb-6 border-b ${
            isDark
              ? "text-white border-gray-700"
              : "text-black border-gray-200"
          }`}
        />

        {/* Answer Options Label */}
        <Text className={`text-sm font-medium mb-3 ${isDark ? "text-blue-400" : "text-blue-500"}`}>
          Answer options
        </Text>

        {/* Options List */}
        {options.map((option, index) => (
          <View key={option.id} className="flex-row items-center mb-3">
            <TextInput
              placeholder={`Option ${index + 1}`}
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              value={option.text}
              onChangeText={(text) => updateOption(option.id, text)}
              className={`flex-1 text-base py-3 border-b ${
                isDark
                  ? "text-white border-gray-700"
                  : "text-black border-gray-200"
              }`}
            />
            {options.length > 1 && (
              <TouchableOpacity
                onPress={() => removeOption(option.id)}
                className="ml-3 p-1"
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={isDark ? "#6b7280" : "#9ca3af"}
                />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Add Option Button */}
        {options.length < 12 && (
          <TouchableOpacity
            onPress={addOption}
            className="flex-row items-center py-3 mt-2"
          >
            <View
              className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                isDark ? "bg-blue-500" : "bg-blue-500"
              }`}
            >
              <Ionicons name="add" size={18} color="white" />
            </View>
            <Text className={`text-base ${isDark ? "text-blue-400" : "text-blue-500"}`}>
              Add an Option...
            </Text>
          </TouchableOpacity>
        )}

        {options.length < 12 && (
          <Text className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            You can add {12 - options.length} more option
            {12 - options.length !== 1 ? "s" : ""}.
          </Text>
        )}

        {/* Settings */}
        <View className={`mt-6 pt-4 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <Text className={`text-sm font-medium mb-3 ${isDark ? "text-blue-400" : "text-blue-500"}`}>
            Settings
          </Text>

          <TouchableOpacity
            onPress={() => setMultipleChoice(!multipleChoice)}
            className={`flex-row items-center justify-between py-3 border-b ${
              isDark ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <Text className={`text-base ${isDark ? "text-white" : "text-black"}`}>
              Multiple Answers
            </Text>
            <View
              className={`w-12 h-7 rounded-full p-1 ${
                multipleChoice
                  ? isDark
                    ? "bg-blue-500"
                    : "bg-blue-500"
                  : isDark
                  ? "bg-gray-600"
                  : "bg-gray-300"
              }`}
            >
              <View
                className={`w-5 h-5 rounded-full bg-white ${
                  multipleChoice ? "ml-auto" : ""
                }`}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}