// app/chat/Polling.tsx

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import Checkbox from "expo-checkbox";
import { API_URL } from "@/constants/api";
import axios from "axios";
import { router } from "expo-router";
import DateTimePicker from "@/components/chat/DateTimePicker";
import { AuthStorage } from '@/utils/authStorage';
import { Ionicons } from "@expo/vector-icons";

type Options = {
  id: string;
  text: string;
};

export default function Poling() {
  const { roomId, userId } = useLocalSearchParams();
  // console.log("roomId", roomId);
  // console.log("userId", userId);
  const [question, setQuestion] = useState("");
  const [optionText, setOptionText] = useState("");
  const [options, setOptions] = useState<Options[]>([]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [pollId,setpollId]=useState(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [sendingPoll, setSendingPoll] = useState(false);
  
  const optionInputRef = useRef<TextInput>(null);

  // Option manipulation functions
  const moveOptionUp = (optionId: string) => {
    const currentIndex = options.findIndex(option => option.id === optionId);
    if (currentIndex > 0) {
      const newOptions = [...options];
      [newOptions[currentIndex - 1], newOptions[currentIndex]] = [newOptions[currentIndex], newOptions[currentIndex - 1]];
      setOptions(newOptions);
    }
  };

  const moveOptionDown = (optionId: string) => {
    const currentIndex = options.findIndex(option => option.id === optionId);
    if (currentIndex < options.length - 1) {
      const newOptions = [...options];
      [newOptions[currentIndex], newOptions[currentIndex + 1]] = [newOptions[currentIndex + 1], newOptions[currentIndex]];
      setOptions(newOptions);
    }
  };

  const removeOption = (optionId: string) => {
    setOptions(options.filter(option => option.id !== optionId));
  };

  const addOption = () => {
    if (optionText.trim()) {
      setOptions([
        ...options,
        { id: `${Date.now()}-${Math.random()}`, text: optionText.trim() },
      ]);
      setOptionText("");
      // Keep the input focused to prevent keyboard from hiding
      setTimeout(() => {
        optionInputRef.current?.focus();
      }, 100);
    }
  };
  const sendPoll = async () => {
    if (sendingPoll) return null; // Prevent multiple calls
    
    setSendingPoll(true);
    try {
      const response = await axios.post(`${API_URL}/api/poll`, {
        question: question,
        options: options,
        isMultipleChoiceAllowed: multipleChoice,
        pollEndTime: endTime,
        roomId: roomId,
        createdBy: userId,
      });
      const createdPollId = response.data.poll.id;
      console.log("Response after creating poll", response.data);
      console.log("poll id is ",createdPollId);
      return createdPollId;
    } catch (error) {
      console.error("Error creating poll:", error);
      Alert.alert("Failed to create poll");
      return null;
    } finally {
      setSendingPoll(false);
    }
  };
  
  const sendpollinmessage = async (pollId: number) => {
    try {
      const messageText = "";
      const token = await AuthStorage.getToken();
      console.log("token is ",token);
      console.log("poll id here is",pollId);
      const pollResponse = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        {
          messageText,
          messageType: "poll",
          pollId: pollId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("Response after sending poll in message", pollResponse.data);
      router.back();
    } catch (error) {
      console.error("Error sending poll in message:", error);
      Alert.alert("Failed to send poll message");
    }
  };
  
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4">
        {/* Header */}
        <View className="py-4">
          <Text className="text-2xl font-bold text-gray-800 text-center">Create Poll</Text>
        </View>

        {/* Question Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-700 mb-2">Poll Question</Text>
          <TextInput
            placeholder="What would you like to ask?"
            className="bg-white border border-gray-300 rounded-lg p-4 text-gray-800 min-h-[60px]"
            value={question}
            onChangeText={setQuestion}
            multiline={true}
            textAlignVertical="top"
            style={{ fontSize: 16 }}
          />
        </View>

        {/* Multiple Choice Option */}
        <View className="mb-6">
          <View className="flex-row items-center bg-white p-4 rounded-lg border border-gray-300">
            <Checkbox 
              value={multipleChoice} 
              onValueChange={setMultipleChoice}
              color={multipleChoice ? '#3B82F6' : undefined}
            />
            <Text className="ml-3 text-gray-700 font-medium">Allow multiple selections</Text>
          </View>
        </View>

        {/* Options Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-700 mb-3">Poll Options</Text>
          
          {/* Options List */}
          {options.length === 0 ? (
            <View className="bg-white p-8 rounded-lg border border-gray-300 items-center">
              <Ionicons name="list-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 mt-2 text-center">No options added yet</Text>
              <Text className="text-gray-400 text-sm mt-1">Add some options below</Text>
            </View>
          ) : (
            <View className="space-y-2">
              {options.map((item, index) => (
                <View key={item.id} className="bg-white rounded-lg border border-gray-300 p-3">
                  <View className="flex-row items-center justify-between">
                    {/* Option Text */}
                    <View className="flex-1 mr-3">
                      <TextInput
                        className="text-gray-800 text-base p-2 bg-gray-50 rounded-md border border-gray-200"
                        value={item.text}
                        onChangeText={(text) => {
                          setOptions(
                            options.map((option) =>
                              option.id === item.id ? { ...option, text } : option
                            )
                          );
                        }}
                        multiline={true}
                        placeholder={`Option ${index + 1}`}
                      />
                    </View>
                    
                    {/* Control Buttons */}
                    <View className="flex-row items-center space-x-1">
                      {/* Move Up */}
                      <TouchableOpacity
                        onPress={() => moveOptionUp(item.id)}
                        disabled={index === 0}
                        className={`p-2 rounded-md ${index === 0 ? 'bg-gray-100' : 'bg-blue-50'}`}
                      >
                        <Ionicons 
                          name="chevron-up" 
                          size={16} 
                          color={index === 0 ? '#9CA3AF' : '#3B82F6'} 
                        />
                      </TouchableOpacity>
                      
                      {/* Move Down */}
                      <TouchableOpacity
                        onPress={() => moveOptionDown(item.id)}
                        disabled={index === options.length - 1}
                        className={`p-2 rounded-md ${index === options.length - 1 ? 'bg-gray-100' : 'bg-blue-50'}`}
                      >
                        <Ionicons 
                          name="chevron-down" 
                          size={16} 
                          color={index === options.length - 1 ? '#9CA3AF' : '#3B82F6'} 
                        />
                      </TouchableOpacity>
                      
                      {/* Remove */}
                      <TouchableOpacity
                        onPress={() => removeOption(item.id)}
                        className="p-2 rounded-md bg-red-50"
                      >
                        <Ionicons name="close" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Add Option Section */}
        <View className="mb-6">
          <View className="flex-row space-x-3">
            <TextInput
              ref={optionInputRef}
              placeholder="Add a new option..."
              className="flex-1 bg-white border border-gray-300 rounded-lg p-4 text-gray-800"
              value={optionText}
              onChangeText={setOptionText}
              style={{ fontSize: 16 }}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              className={`px-6 py-4 rounded-lg justify-center ${
                optionText.trim().length === 0 ? "bg-gray-300" : "bg-blue-500"
              }`}
              onPress={addOption}
              disabled={optionText.trim().length === 0}
            >
              <Text className={`font-semibold ${
                optionText.trim().length === 0 ? "text-gray-500" : "text-white"
              }`}>
                Add
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Create Poll Button */}
        <View className="mb-8">
          <TouchableOpacity
            className={`py-4 rounded-lg ${
              question.trim().length === 0 || options.length < 2 
                ? "bg-gray-300" 
                : "bg-blue-500"
            }`}
            disabled={question.trim().length === 0 || options.length < 2}
            onPress={() => setShowScheduleModal(true)}
          >
            <Text className={`text-center font-semibold text-lg ${
              question.trim().length === 0 || options.length < 2 
                ? "text-gray-500" 
                : "text-white"
            }`}>
              Create Poll
            </Text>
          </TouchableOpacity>
          {(question.trim().length === 0 || options.length < 2) && (
            <Text className="text-gray-500 text-sm text-center mt-2">
              {question.trim().length === 0 
                ? "Please enter a question" 
                : "Please add at least 2 options"}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Schedule Modal */}
      <Modal visible={showScheduleModal} transparent={true} animationType="slide">
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-3xl p-6 max-h-96">
            <Text className="text-xl font-bold text-gray-800 text-center mb-4">
              Schedule Poll End Time
            </Text>
            
            <DateTimePicker
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedTime={selectedTime} 
              setSelectedTime={setSelectedTime}
            />
            
            <View className="mt-6 space-y-3">
              <TouchableOpacity
                className={`py-4 rounded-lg ${sendingPoll ? 'bg-gray-400' : 'bg-blue-500'}`}
                disabled={sendingPoll}
                onPress={async () => {
                  const createdPollId = await sendPoll();
                  if (createdPollId) {
                    await sendpollinmessage(createdPollId);
                  }
                  setShowScheduleModal(false);
                }}
              >
                <View className="flex-row items-center justify-center">
                  {sendingPoll && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                  <Text className="text-white text-center font-semibold text-lg">
                    {sendingPoll ? 'Sending...' : 'Send Poll'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setShowScheduleModal(false)}
                className="py-3"
              >
                <Text className="text-gray-500 text-center font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={showModal} transparent={true} animationType="slide">
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white p-6 rounded-2xl w-11/12 max-w-sm">
            <Text className="text-xl font-bold text-gray-800 mb-4 text-center">
              Poll Preview
            </Text>
            
            <View className="mb-4">
              <Text className="font-semibold text-gray-700 mb-1">Question:</Text>
              <Text className="text-gray-600 mb-3">{question}</Text>
              
              <Text className="font-semibold text-gray-700 mb-1">Options:</Text>
              {options.map((option, index) => (
                <Text key={option.id} className="text-gray-600 ml-2">
                  {index + 1}. {option.text}
                </Text>
              ))}
              
              <Text className="font-semibold text-gray-700 mt-3 mb-1">Settings:</Text>
              <Text className="text-gray-600 ml-2">
                Multiple Choice: {multipleChoice ? "Yes" : "No"}
              </Text>
              {endTime && (
                <Text className="text-gray-600 ml-2">End Time: {endTime}</Text>
              )}
            </View>

            <View className="space-y-3">
              <TouchableOpacity
                className={`py-3 rounded-lg ${sendingPoll ? 'bg-gray-400' : 'bg-blue-500'}`}
                disabled={sendingPoll}
                onPress={async () => {
                  const createdPollId = await sendPoll();
                  if (createdPollId) {
                    await sendpollinmessage(createdPollId);
                  }
                  setShowModal(false);
                }}
              >
                <View className="flex-row items-center justify-center">
                  {sendingPoll && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                  <Text className="text-white text-center font-semibold">
                    {sendingPoll ? 'Sending...' : 'Confirm & Send Poll'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text className="text-center text-gray-500 font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


