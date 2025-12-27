import {
     Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import React from "react";

const NoChatRoomComponenet = ({ searchQuery }: { searchQuery: string }) => {
    return (
        <View className="flex-1 justify-center items-center p-4 mt-10">
            <Ionicons
                name="chatbubble-ellipses-outline"
                size={60}
                color="#d1d5db"
            />
            <Text className="text-gray-500 mt-4 text-center">
                {searchQuery.length > 0
                    ? "No chat rooms match your search."
                    : "No chat rooms available."}
            </Text>
        </View>
    );
}
export default React.memo(NoChatRoomComponenet);
