import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import RenderHtml from "react-native-render-html";

type Props = {
  messageText: string;
  isOwnMessage: boolean;
  contentWidth: number;
};

export default function AnnouncementMessage({
  messageText,
  isOwnMessage,
  contentWidth,
}: Props) {
  const SEPARATOR = "|||ANNOUNCEMENT_SEPARATOR|||";
  const parts = messageText.split(SEPARATOR);
  const title = parts[0] || "Untitled";
  const body = parts[1] || "";

  const tagsStyles = {
    body: {
      color: "#1f2937",
      fontSize: 15,
      lineHeight: 22,
    },
    p: {
      marginVertical: 4,
    },
    h1: {
      fontSize: 22,
      fontWeight: "600",
      marginVertical: 8,
    },
    h2: {
      fontSize: 20,
      fontWeight: "600",
      marginVertical: 6,
    },
    h3: {
      fontSize: 18,
      fontWeight: "600",
      marginVertical: 4,
    },
    ul: {
      marginVertical: 4,
      paddingLeft: 20,
    },
    ol: {
      marginVertical: 4,
      paddingLeft: 20,
    },
    li: {
      marginVertical: 2,
    },
    a: {
      color: "#2563eb",
      textDecorationLine: "underline",
    },
  };

  return (
    <View
      className={`p-3 rounded-lg ${
        isOwnMessage
          ? "bg-blue-50 border-l-4 border-blue-500"
          : "bg-orange-50 border-l-4 border-orange-500"
      }`}
    >
      <View className="flex-row items-center mb-2">
        <Ionicons
          name="megaphone"
          size={20}
          color={isOwnMessage ? "#2563eb" : "#f97316"}
        />
        <Text
          className={`ml-2 font-bold text-sm ${
            isOwnMessage ? "text-blue-600" : "text-orange-600"
          }`}
        >
          ANNOUNCEMENT
        </Text>
      </View>

      <Text
        className={`text-lg font-bold mb-2 ${
          isOwnMessage ? "text-blue-900" : "text-gray-900"
        }`}
      >
        {title}
      </Text>

      {body &&
        body.trim() !== "" &&
        body !== "<p></p>" &&
        body !== "<p><br></p>" && (
          <View
            className="mb-2 p-2 rounded-lg"
            style={{
              backgroundColor: isOwnMessage ? "#eff6ff" : "#fff7ed",
            }}
          >
            <RenderHtml
              contentWidth={contentWidth}
              source={{ html: body }}
              tagsStyles={tagsStyles}
              enableExperimentalMarginCollapsing={true}
              enableExperimentalBRCollapsing={true}
              defaultTextProps={{
                selectable: true,
              }}
              renderersProps={{
                img: {
                  enableExperimentalPercentWidth: true,
                },
              }}
            />
          </View>
        )}
    </View>
  );
}
