import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import Checkbox from "expo-checkbox";
type Options = {
  id: string;
  text: string;
};
import DateTimePicker from "../../../components/chat/DatePicker";
export default function Poling() {
  const { roomId, userId } = useLocalSearchParams();
  console.log("roomId", roomId);
  console.log("userId", userId);
  const [question, setQuestion] = useState("");
  const [optionText, setOptionText] = useState("");
  const [options, setOptions] = useState<Options[]>([]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [date, setDate] = useState(new Date());
  console.log("multipleChoice", multipleChoice);
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
        <TouchableOpacity
          className={`w-1/4  rounded-md p-2 ${
            options.length === 0 ? "bg-gray-300" : "bg-blue-500"
          }`}
          disabled={options.length === 0}
          onPress={() => {
            console.log(question, options);
            console.log(options.map((option) => option.text));

            setOptionText("");
            setOptions([]);
            setQuestion("");
            console.log("sending poll");
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
          <DateTimePicker />
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
