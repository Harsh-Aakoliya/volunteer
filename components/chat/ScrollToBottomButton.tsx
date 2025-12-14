import React from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ScrollToBottomButtonProps = {
  visible: boolean;
  onPress: () => void;
};

export default function ScrollToBottomButton({
  visible,
  onPress,
}: ScrollToBottomButtonProps) {
  if (!visible) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute bottom-20 right-4 bg-blue-500 rounded-full p-3 shadow-lg"
      style={{ zIndex: 1000 }}
    >
      <Ionicons name="arrow-down" size={20} color="white" />
    </TouchableOpacity>
  );
}
