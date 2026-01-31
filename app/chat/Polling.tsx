// app/chat/Polling.tsx

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { API_URL } from "@/constants/api";
import axios from "axios";
import { router } from "expo-router";
import { AuthStorage } from '@/utils/authStorage';
import { Ionicons } from "@expo/vector-icons";
import { useSocket } from "@/contexts/SocketContext";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type Options = {
  id: string;
  text: string;
};

export default function Polling() {
  const { roomId, userId } = useLocalSearchParams();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<Options[]>([
    { id: `${Date.now()}-1`, text: "" },
    { id: `${Date.now()}-2`, text: "" }
  ]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [sendingPoll, setSendingPoll] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const {
    sendMessage:socketSendMessage,
  } = useSocket();

  const removeOption = (optionId: string) => {
    if (options.length > 1) {
      setOptions(options.filter(option => option.id !== optionId));
    }
  };

  const addOption = () => {
    if (options.length < 12) {
      const newOption = { id: `${Date.now()}-${Math.random()}`, text: "" };
      setOptions(prevOptions => [...prevOptions, newOption]);
    }
  };

  const updateOptionText = (optionId: string, text: string) => {
    setOptions(
      options.map((option) =>
        option.id === optionId ? { ...option, text } : option
      )
    );
  };

  const sendPoll = async () => {
    if (sendingPoll) return;
    
    setSendingPoll(true);
    try {
      const validOptions = options.filter(opt => opt.text.trim() !== "");
      
      const response = await axios.post(`${API_URL}/api/poll`, {
        question: question,
        options: validOptions,
        isMultipleChoiceAllowed: multipleChoice,
        pollEndTime: null,
        roomId: roomId,
        createdBy: userId,
      });
      const createdPollId = response.data.poll.id;
      
      const messageText = "";
      const token = await AuthStorage.getToken();
      
      const pollResponse = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        {
          messageText,
          messageType: "poll",
          pollId: createdPollId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      socketSendMessage(roomId as string, {
        id: pollResponse.data.id,
        messageText: "",
        createdAt: pollResponse.data.createdAt,
        messageType: "poll",
        mediaFilesId: 0,
        pollId: pollResponse.data.pollId,
        tableId: 0,
        replyMessageId: 0,
      });
      
      router.back();
    } catch (error) {
      console.error("Error creating poll:", error);
      Alert.alert("Failed to create poll");
    } finally {
      setSendingPoll(false);
    }
  };

  const validOptions = options.filter(opt => opt.text.trim() !== "");
  const isCreateEnabled = question.trim() !== "" && validOptions.length >= 2;

  const renderOptionItem = ({ item, drag, isActive }: RenderItemParams<Options>) => (
    <ScaleDecorator>
      <View className="flex-row items-center mb-3">
        <TouchableOpacity onLongPress={drag} disabled={isActive} className="mr-3">
          <Ionicons name="menu" size={20} color={isDark ? "#8E8E93" : "#C7C7CC"} />
        </TouchableOpacity>
        
        <TextInput
          placeholder="Option"
          placeholderTextColor={isDark ? "#8E8E93" : "#C7C7CC"}
          className={`flex-1 ${isDark ? "text-white border-gray-700" : "text-black border-gray-200"} text-base py-2 border-b`}
          value={item.text}
          onChangeText={(text) => updateOptionText(item.id, text)}
          style={{ fontSize: 16 }}
        />
        
        {options.length > 1 && (
          <TouchableOpacity
            onPress={() => removeOption(item.id)}
            className="ml-3 p-1"
          >
            <Ionicons name="close-circle" size={22} color={isDark ? "#8E8E93" : "#C7C7CC"} />
          </TouchableOpacity>
        )}
      </View>
    </ScaleDecorator>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className={`flex-1 ${isDark ? "bg-[#0E1621]" : "bg-white"}`}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View className={`flex-row items-center justify-between px-4 py-3 ${isDark ? "border-gray-700" : "border-gray-200"} border-b`}>
            <TouchableOpacity onPress={() => router.back()} className="p-2">
              <Ionicons name="arrow-back" size={24} color={isDark ? "#8E8E93" : "#007AFF"} />
            </TouchableOpacity>
            
            <Text className={`${isDark ? "text-white" : "text-black"} text-lg font-semibold`}>New Poll</Text>
            
            <TouchableOpacity 
              onPress={sendPoll}
              disabled={!isCreateEnabled || sendingPoll}
              className="p-2"
            >
              {sendingPoll ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text className={`text-base font-semibold ${
                  isCreateEnabled ? "text-[#007AFF]" : isDark ? "text-gray-600" : "text-gray-400"
                }`}>
                  CREATE
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-1">
            {/* Poll Question */}
            <View className={`px-4 py-3 ${isDark ? "border-gray-700" : "border-gray-200"} border-b`}>
              <Text className={`${isDark ? "text-[#3B82F6]" : "text-[#007AFF]"} text-sm mb-2`}>Poll question</Text>
              <TextInput
                placeholder="Ask a question"
                placeholderTextColor={isDark ? "#8E8E93" : "#C7C7CC"}
                className={`${isDark ? "text-white" : "text-black"} text-base py-2`}
                value={question}
                onChangeText={setQuestion}
                multiline={false}
                style={{ fontSize: 16 }}
              />
            </View>

            {/* Answer Options */}
            <View className={`px-4 py-3 ${isDark ? "border-gray-700" : "border-gray-200"} border-b flex-1`}>
              <Text className={`${isDark ? "text-[#3B82F6]" : "text-[#007AFF]"} text-sm mb-3`}>Answer options</Text>
              
              <DraggableFlatList
                data={options}
                onDragEnd={({ data }) => setOptions(data)}
                keyExtractor={(item) => item.id}
                renderItem={renderOptionItem}
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={
                  <View>
                    {options.length < 12 && (
                      <TouchableOpacity
                        onPress={addOption}
                        className="flex-row items-center py-3"
                      >
                        <View className={`w-6 h-6 rounded-full ${isDark ? "bg-[#3B82F6]" : "bg-[#007AFF]"} items-center justify-center mr-3`}>
                          <Ionicons name="add" size={18} color="white" />
                        </View>
                        <Text className={`${isDark ? "text-[#3B82F6]" : "text-[#007AFF]"} text-base`}>Add an Option...</Text>
                      </TouchableOpacity>
                    )}
                    
                    {options.length < 12 && (
                      <Text className={`${isDark ? "text-gray-500" : "text-gray-400"} text-xs mt-1 mb-4`}>
                        You can add {12 - options.length} more option{12 - options.length !== 1 ? 's' : ''}.
                      </Text>
                    )}

                    {/* Settings */}
                    <View className={`py-3 mt-2 ${isDark ? "border-gray-700" : "border-gray-200"} border-t`}>
                      <Text className={`${isDark ? "text-[#3B82F6]" : "text-[#007AFF]"} text-sm mb-3`}>Settings</Text>
                      
                      <TouchableOpacity
                        onPress={() => {
                          if (validOptions.length >= 2) {
                            setMultipleChoice(!multipleChoice);
                          }
                        }}
                        disabled={validOptions.length < 2}
                        className={`flex-row items-center justify-between py-3 ${isDark ? "border-gray-700" : "border-gray-200"} border-b`}
                      >
                        <Text className={`text-base ${
                          validOptions.length >= 2 
                            ? isDark ? "text-white" : "text-black"
                            : isDark ? "text-gray-600" : "text-gray-400"
                        }`}>
                          Multiple Answers
                        </Text>
                        <View className={`w-12 h-7 rounded-full p-1 ${
                          multipleChoice && validOptions.length >= 2 
                            ? isDark ? "bg-[#3B82F6]" : "bg-[#007AFF]"
                            : isDark ? "bg-gray-600" : "bg-gray-300"
                        }`}>
                          <View className={`w-5 h-5 rounded-full bg-white ${
                            multipleChoice ? "ml-auto" : ""
                          }`} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}