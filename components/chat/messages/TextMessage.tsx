import React from "react";
import { View, Text } from "react-native";

type Props = {
  text?: string | null;
  isOwnMessage: boolean;
};

export default function TextMessage({ text, isOwnMessage }: Props) {
  if (!text) return null;

  return (
    <View>
      <Text
        className={`text-base leading-5 ${
          isOwnMessage ? "text-gray-900" : "text-gray-800"
        }`}
      >
        {text}
      </Text>
    </View>
  );
}
