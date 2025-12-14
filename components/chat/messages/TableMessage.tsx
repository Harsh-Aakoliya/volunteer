import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

type Props = {
  tableId: number | null;
  isOwnMessage: boolean;
  onOpenTable: (tableId: number) => void;
};

export default function TableMessage({
  tableId,
  isOwnMessage,
  onOpenTable,
}: Props) {
  if (!tableId) return null;

  return (
    <TouchableOpacity
      onPress={() => {
        if (typeof tableId === "number") {
          onOpenTable(tableId);
        }
      }}
      className={`p-2 rounded-lg mt-1 ${
        isOwnMessage ? "bg-blue-200" : "bg-gray-200"
      }`}
    >
      <Text
        className={`font-semibold ${
          isOwnMessage ? "text-blue-800" : "text-gray-700"
        }`}
      >
        📊 Table
      </Text>
      <Text
        className={`text-xs ${
          isOwnMessage ? "text-blue-600" : "text-gray-600"
        }`}
      >
        Tap to view table
      </Text>
    </TouchableOpacity>
  );
}
