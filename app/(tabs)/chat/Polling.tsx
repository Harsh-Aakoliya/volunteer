import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import Checkbox from "expo-checkbox";
import { API_URL } from "../../../constants/api";
import axios from "axios";
type Options = {
  id: string;
  text: string;
};
// import DateTimePicker from "../../../components/chat/DatePicker";
export default function Poling() {
  const { roomId, userId } = useLocalSearchParams();
  // console.log("roomId", roomId);
  // console.log("userId", userId);
  const [question, setQuestion] = useState("");
  const [optionText, setOptionText] = useState("");
  const [options, setOptions] = useState<Options[]>([]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [endTime, setEndTime] = useState(new Date().toLocaleString());
  // console.log("multipleChoice", multipleChoice);

  async function sendPoll() {
    const response = await axios.post(`${API_URL}/api/poll`, {
      question: question,
      options: options,
      isMultipleChoiceAllowed: multipleChoice,
      pollEndTime: endTime,
      roomId: roomId,
      createdBy: userId,
    });
    console.log("response", response.data.poll);
  }
  return (
    
    <View className="flex-1 p-2">
      <View className="flex-row items-center justify-between pt-2 pb-2">
        <TextInput
          placeholder="Enter your question"
          className="border-2 border-gray-300 rounded-md p-2 w-3/4"
          value={question}
          onChangeText={(text) => {
            setQuestion(text);
          }}
        />
        {showModal ? (
            <Modal visible={showModal} transparent={true} animationType="slide">
              <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
                <View className="bg-white p-4 rounded-md w-11/12">
                  <Text className="text-lg font-bold mb-2">Poll Information</Text>
                  <Text className="mb-1">Question: {question}</Text>
                  <Text className="mb-1">
                    Options: {options.map((option) => option.text).join(", ")}
                  </Text>
                  <Text className="mb-1">
                    Multiple Choice: {multipleChoice ? "Yes" : "No"}
                  </Text>
                  <Text className="mb-4">End Time: {endTime}</Text>

                  <TouchableOpacity
                    className="bg-blue-500 p-2 rounded-md mb-2"
                    onPress={() => {
                      sendPoll();
                      setOptionText("");
                      setOptions([]);
                      setQuestion("");
                      setShowModal(false);
                    }}
                  >
                    <Text className="text-white text-center">Confirm poll and send</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Text className="text-center text-red-500">Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          ):null}

        <TouchableOpacity
          className={`w-1/4  rounded-md p-2 ${
            options.length === 0 ? "bg-gray-300" : "bg-blue-500"
          }`}
          disabled={options.length === 0}
          onPress={() => {
            setShowModal(true);
          }}
        >
          <Text>Create Poll</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Checkbox value={multipleChoice} onValueChange={setMultipleChoice} />
          <Text>Allow Multiple Choice</Text>
        </View>
        <View>
          <Text>Set finish time</Text>
          <View className="flex-row items-center gap-2">

            <TextInput
              className="border-2 border-gray-300 rounded-md p-2  h-12"
              placeholder="Enter poll end time"
              onChangeText={(endTime: string) => {
                setEndTime(endTime);
              }}
              value={endTime}
              />
          <Text>DD/MM/YYYY HH/MM</Text>
              </View>
        </View>
        <Text className="text-lg font-bold pl-2">Options</Text>
        {options.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-center text-gray-500">No options added</Text>
          </View>
        ) : (
          <FlatList
            data={options}
            renderItem={({ item }) => (
              <View className="p-2 border-b border-gray-300 flex-row justify-between items-center">
                <View className="flex-row items-center w-3/4">
                  <TextInput
                    className="border-2 border-gray-300 rounded-md p-2 w-full h-full"
                    value={item.text}
                    onChangeText={(text) => {
                      setOptions(
                        options.map((option) =>
                          option.id === item.id ? { ...option, text } : option
                        )
                      );
                    }}
                    multiline={true}
                  />
                </View>
                <View className="flex-row items-center w-1/4">
                  <TouchableOpacity
                    onPress={() => {
                      setOptions(
                        options.filter((option) => option.id !== item.id)
                      );
                    }}
                  >
                    <Text>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={{ flexGrow: 1 }}
          />
        )}
      </View>
      <View className="flex-row">
        <TextInput
          placeholder="Enter your option"
          className="w-3/4 border-2 border-gray-300 rounded-md p-2"
          value={optionText}
          onChangeText={(text) => {
            setOptionText(text);
          }}
        />
        <TouchableOpacity
          className={`w-1/4 ${
            optionText.length === 0 ? "bg-gray-300" : "bg-blue-500"
          } rounded-md p-2`}
          onPress={() => {
            setOptions([
              ...options,
              { id: `${Date.now()}-${Math.random()}`, text: optionText },
            ]);
            setOptionText("");
          }}
          disabled={optionText.length === 0}
        >
          <Text>Add Option</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


