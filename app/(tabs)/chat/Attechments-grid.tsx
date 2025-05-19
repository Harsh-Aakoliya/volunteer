import { View, Text, TouchableOpacity } from "react-native";
import SVGComponent from "../../../components/Icons/MdPermMedia";
import { useRouter } from "expo-router";
import { useLocalSearchParams } from "expo-router";
export default function OptionalGrid() {
    const router = useRouter();
    const { roomId, userId } = useLocalSearchParams();
    console.log("roomId", roomId);
    console.log("userId", userId);
  return (
    <View className="flex flex-wrap flex-row">
        <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={() => router.push({
            pathname: "/chat/MediaUploader",
            params: { roomId, userId }
        })}>
            <SVGComponent color="black" height={60} width={60} />
            <Text>Multimedia</Text>
        </TouchableOpacity>
        </View>
        <View className="w-1/3 items-center justify-center">
        <TouchableOpacity onPress={() => router.push({
            pathname: "/chat/Polling",
            params: { roomId, userId }
        })}>
            <SVGComponent color="black" height={60} width={60} />
            <Text>Poll</Text>
        </TouchableOpacity>
        </View>
        <View className="w-1/3 items-center justify-center">
            <SVGComponent color="black" height={60} width={60} />
            <Text>Document</Text>
        </View>
        <View className="w-1/3 items-center justify-center">
            <SVGComponent color="black" height={60} width={60} />
            <Text>Table</Text>
        </View>
        <View className="w-1/3 items-center justify-center">
            <SVGComponent color="black" height={60} width={60} />
            <Text>Temp</Text>
        </View>
        <View className="w-1/3 items-center justify-center">
            <SVGComponent color="black" height={60} width={60} />
            <Text>Temp</Text>
        </View>
        

      {/* {[...Array(7)].map((_, index) => (
        <View key={index} className="w-1/3 p-2 items-center justify-center">
          <SVGComponent color="black" height={60} width={60} />
        </View>
      ))} */}
    </View>
  );
}
