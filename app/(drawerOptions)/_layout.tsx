import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";

const formatTitle = (name?: string) => {
  if (!name) return "Details";
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function DrawerOptionsLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        headerTitle: () => (
          <Text className="text-lg font-JakartaSemiBold text-gray-900">
            {formatTitle(route.name)}
          </Text>
        ),
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.replace("/(drawer)")}
            className="flex-row items-center px-3 py-2"
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        ),
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: "#fff",
        },
      })}
    />
  );
}
