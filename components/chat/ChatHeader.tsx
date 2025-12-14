import React from "react";
import { View, Text } from "react-native";

type Props = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPressTitle?: () => void;
};

export default function ChatHeader({ title, subtitle, right, onPressTitle }: Props) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text className="text-base font-semibold flex-1" numberOfLines={1} onPress={onPressTitle}>
        {title || "Chat"}
      </Text>
      {subtitle ? (
        <Text className="text-xs text-gray-500 ml-2" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
      <View className="ml-2">{right}</View>
    </View>
  );
}
