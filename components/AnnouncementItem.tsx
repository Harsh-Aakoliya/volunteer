// components/AnnouncementItem.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image as RNImage,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Announcement } from "@/types/type";
import { API_URL } from "@/constants/api";

interface AnnouncementItemProps {
  item: Announcement;
  currentUserId: string;
  onOpenAnnouncement: (item: Announcement) => void;
  formatDateTime: (date: string) => string;
  isAnnouncementOpening: boolean;
  onShowReadDetails?: (announcementId: number, departmentTag?: string[]) => void;
  onShowLikeDetails?: (announcementId: number) => void;
  isScheduled: boolean;
}

const { height: screenHeight } = Dimensions.get('window');
const announcementHeight = screenHeight / 4; // Each announcement takes 1/4 of screen height

const AnnouncementItem: React.FC<AnnouncementItemProps> = ({
  item,
  currentUserId,
  onOpenAnnouncement,
  formatDateTime,
  isAnnouncementOpening,
  onShowReadDetails,
  onShowLikeDetails,
  isScheduled,
}) => {
  const [imageUri, setImageUri] = useState<string>(
    item.hasCoverImage
      ? `${API_URL}/media/announcement/${item.id}/coverimage.jpg`
      : `${API_URL}/media/announcement/defaultcoverimage.png`
  );
  const [loading, setLoading] = useState(true);

  const isRead = item.readBy?.some(read => read.userId === currentUserId) || false;
  const isAuthor = item.authorId === currentUserId;

  const handleImageError = () => {
    // console.log(`⚠️ Cover image failed for announcement ${item.id}, falling back to default.`);
    setImageUri(`${API_URL}/media/announcement/defaultcoverimage.png`);
  };

  // Show loading state when announcement is opening
  if (isAnnouncementOpening) {
    return (
      <View
        className={`mx-4 my-1 ${isRead ? 'bg-gray-50' : 'bg-blue-50'}`}
        style={{ height: announcementHeight }}
      >
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#007AFF" />
          <Text className="mt-2 text-gray-600">Opening announcement...</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => onOpenAnnouncement(item)}
      disabled={isAnnouncementOpening}
      className={` mx-1 my-1 ${(isRead || isScheduled) ? 'bg-gray-50' : 'bg-blue-50'}`}
      style={{ height: announcementHeight }}
      activeOpacity={0.7}
    >
      {/* Top-right icon */}
      <View className="absolute top-4 right-4 z-10">
        {item.status === 'scheduled' ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              // Handle scheduling details if needed
            }}
            className="bg-yellow-100 rounded-full p-2"
          >
            <Ionicons name="time-outline" size={20} color="#f59e0b" />
          </TouchableOpacity>
        ) : isAuthor ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              // Show analytics modal with both read and like data
              onShowReadDetails?.(item.id, item.departmentTag);
            }}
            className="bg-blue-100 rounded-full p-2"
          >
            <Ionicons name="stats-chart" size={20} color="#3b82f6" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Content */}
      <View className="flex-1 p-4 pr-16 justify-center">
        {/* Title */}
        <Text
          className="text-2xl font-bold text-gray-900 mb-4"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item.title}
        </Text>
        
        {/* Body Preview */}
        <Text 
          className="text-lg text-gray-600 flex-1" 
          numberOfLines={8} 
          ellipsizeMode="tail"
        >
          {item.body.replace(/<[^>]*>/g, '').substring(0, 300)}...
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default AnnouncementItem;