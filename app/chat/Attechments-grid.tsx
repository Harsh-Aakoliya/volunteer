import { View, TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";
import React from "react";
import Svg, { Path } from "react-native-svg";

interface AttachmentsGridProps {
  roomId: string;
  userId: string;
  onOptionSelect?: () => void;
  onAudioRecord?: () => void;
}

interface IconProps {
  size?: number;
  color?: string;
}

// ---------- SVG ICONS ----------

const GalleryIcon = ({ size = 24, color = "#000" }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.25 12.5L12.1 11C12 10.8667 11.8667 10.8 11.7 10.8C11.5333 10.8 11.4 10.8667 11.3 11L9.625 13.2C9.49167 13.3667 9.47083 13.5417 9.5625 13.725C9.65417 13.9083 9.80833 14 10.025 14H17.975C18.1917 14 18.3458 13.9083 18.4375 13.725C18.5292 13.5417 18.5083 13.3667 18.375 13.2L15.95 10.025C15.85 9.89167 15.7167 9.825 15.55 9.825C15.3833 9.825 15.25 9.89167 15.15 10.025L13.25 12.5ZM8 18C7.45 18 6.97917 17.8042 6.5875 17.4125C6.19583 17.0208 6 16.55 6 16V4C6 3.45 6.19583 2.97917 6.5875 2.5875C6.97917 2.19583 7.45 2 8 2H20C20.55 2 21.0208 2.19583 21.4125 2.5875C21.8042 2.97917 22 3.45 22 4V16C22 16.55 21.8042 17.0208 21.4125 17.4125C21.0208 17.8042 20.55 18 20 18H8ZM4 22C3.45 22 2.97917 21.8042 2.5875 21.4125C2.19583 21.0208 2 20.55 2 20V7C2 6.71667 2.09583 6.47917 2.2875 6.2875C2.47917 6.09583 2.71667 6 3 6C3.28333 6 3.52083 6.09583 3.7125 6.2875C3.90417 6.47917 4 6.71667 4 7V20H17C17.2833 20 17.5208 20.0958 17.7125 20.2875C17.9042 20.4792 18 20.7167 18 21C18 21.2833 17.9042 21.5208 17.7125 21.7125C17.5208 21.9042 17.2833 22 17 22H4Z"
      fill={color}
    />
  </Svg>
);

const PollIcon = ({ size = 24, color = "#000" }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 18C4 17.45 4.19583 16.9792 4.5875 16.5875C4.97917 16.1958 5.45 16 6 16H9C9.55 16 10.0208 16.1958 10.4125 16.5875C10.8042 16.9792 11 17.45 11 18C11 18.55 10.8042 19.0208 10.4125 19.4125C10.0208 19.8042 9.55 20 9 20H6C5.45 20 4.97917 19.8042 4.5875 19.4125C4.19583 19.0208 4 18.55 4 18ZM4 12C4 11.45 4.19583 10.9792 4.5875 10.5875C4.97917 10.1958 5.45 10 6 10H18C18.55 10 19.0208 10.1958 19.4125 10.5875C19.8042 10.9792 20 11.45 20 12C20 12.55 19.8042 13.0208 19.4125 13.4125C19.0208 13.8042 18.55 14 18 14H6C5.45 14 4.97917 13.8042 4.5875 13.4125C4.19583 13.0208 4 12.55 4 12ZM4 6C4 5.45 4.19583 4.97917 4.5875 4.5875C4.97917 4.19583 5.45 4 6 4H13C13.55 4 14.0208 4.19583 14.4125 4.5875C14.8042 4.97917 15 5.45 15 6C15 6.55 14.8042 7.02083 14.4125 7.4125C14.0208 7.80417 13.55 8 13 8H6C5.45 8 4.97917 7.80417 4.5875 7.4125C4.19583 7.02083 4 6.55 4 6Z"
      fill={color}
    />
  </Svg>
);

const AnnouncementIcon = ({ size = 24, color = "#000" }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18 11V7C18 6.4 17.6 6 17 6H15C13.5 6 12.2 6.8 11.4 8H5C3.9 8 3 8.9 3 10V14C3 15.1 3.9 16 5 16H6L5 20C4.9 20.6 5.3 21 5.9 21H7.1C7.6 21 8 20.6 8.1 20L9 16H11.4C12.2 17.2 13.5 18 15 18H17C17.6 18 18 17.6 18 17V13H21C21.6 13 22 12.6 22 12C22 11.4 21.6 11 21 11H18ZM16 16H15C13.9 16 13 15.1 13 14V10C13 8.9 13.9 8 15 8H16V16Z"
      fill={color}
    />
  </Svg>
);

// ---------- MAIN COMPONENT ----------

export default function AttachmentsGrid({
  roomId,
  userId,
  onOptionSelect,
}: AttachmentsGridProps) {
  const router = useRouter();

  const handleOptionPress = (pathname: string, params: any) => {
    onOptionSelect?.();
    router.push({ pathname: pathname as any, params });
  };

  const ICON_SIZE = 36;
  const ICON_COLOR = "#374151";

  const cardShadow = {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  };

  return (
    <View className="flex flex-row py-4 justify-between px-4">
      {/* Gallery */}
      <View className="w-1/3 items-center">
        <TouchableOpacity
          className="items-center"
          onPress={() =>
            handleOptionPress("/chat/MediaUploader", {
              roomId,
              userId,
              vmMedia: "true",
            })
          }
        >
          <View
            className="p-4 bg-purple-50 rounded-2xl mb-2 items-center justify-center"
            style={cardShadow}
          >
            <GalleryIcon size={ICON_SIZE} color={ICON_COLOR} />
          </View>
          <Text className="text-xs text-gray-700 font-medium">Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Poll */}
      <View className="w-1/3 items-center">
        <TouchableOpacity
          className="items-center"
          onPress={() =>
            handleOptionPress("/chat/Polling", { roomId, userId })
          }
        >
          <View
            className="p-4 bg-yellow-50 rounded-2xl mb-2 items-center justify-center"
            style={cardShadow}
          >
            <PollIcon size={ICON_SIZE} color={ICON_COLOR} />
          </View>
          <Text className="text-xs text-gray-700 font-medium">Poll</Text>
        </TouchableOpacity>
      </View>

      {/* Announcement */}
      <View className="w-1/3 items-center">
        <TouchableOpacity
          className="items-center"
          onPress={() =>
            handleOptionPress("/chat/Announcement", { roomId, userId })
          }
        >
          <View
            className="p-4 bg-red-50 rounded-2xl mb-2 items-center justify-center"
            style={cardShadow}
          >
            <AnnouncementIcon size={ICON_SIZE} color={ICON_COLOR} />
          </View>
          <Text className="text-xs text-gray-700 font-medium">Announcement</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
