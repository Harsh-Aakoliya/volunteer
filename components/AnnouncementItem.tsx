// components/AnnouncementItem.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image as RNImage,
  ActivityIndicator,
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

// Removed fixed height to allow natural content sizing

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
  const isUnreadForViewer = !isAuthor && !isRead && item.status === 'published';

  const handleImageError = () => {
    // console.log(`⚠️ Cover image failed for announcement ${item.id}, falling back to default.`);
    setImageUri(`${API_URL}/media/announcement/defaultcoverimage.png`);
  };

  // Show loading state when announcement is opening
  if (isAnnouncementOpening) {
    return (
      <View
        className={`mx-4 my-1 ${isRead ? 'bg-gray-50' : 'bg-blue-50'}`}
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
      className={`mx-3 my-1 rounded-xl border ${
        (isRead || isScheduled)
          ? 'bg-white border-gray-200'
          : 'bg-blue-50 border-blue-200'
      } shadow-sm`}
      activeOpacity={0.7}
    >
      {/* Content */}
      <View className="p-4">
        {/* Title and top-right icon in one row */}
        <View className="mb-2 flex-row items-start justify-between">
          <Text
            className="text-xl font-bold text-gray-900 flex-1"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.title}
          </Text>
          {item.status === 'scheduled' ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                // Handle scheduling details if needed
              }}
              className="ml-3 bg-yellow-100 rounded-full p-2"
            >
              <Ionicons name="time-outline" size={16} color="#f59e0b" />
            </TouchableOpacity>
          ) : isAuthor ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                // Show analytics modal with both read and like data
                onShowReadDetails?.(item.id, item.departmentTag);
              }}
              className="ml-3 bg-blue-100 rounded-full p-2"
            >
              <Ionicons name="stats-chart" size={16} color="#3b82f6" />
            </TouchableOpacity>
          ) : isUnreadForViewer ? (
            <View className="ml-3 w-3 h-3 rounded-full bg-red-500" />
          ) : null}
        </View>

        {/* Body Preview (two lines) */}
        <Text 
          className={`text-base text-gray-600 ${isUnreadForViewer ? 'font-semibold' : ''}`}
          numberOfLines={2} 
          ellipsizeMode="tail"
        >
          {item.body.replace(/<[^>]*>/g, '').substring(0, 300)}...
        </Text>

        {/* Footer: author left (maroon), timestamp right (blue) */}
        <View className="mt-2 flex-row items-center justify-between">
          <Text className={`text-sm ${isUnreadForViewer ? 'font-bold' : 'font-semibold'} text-[#800000]`} numberOfLines={1}>
            {/* {item.authorName} */}
            Sevak Karyalay
          </Text>
          <Text className={`text-xs ${isUnreadForViewer ? 'font-bold' : 'font-medium'} text-blue-600`}>
            {new Date(item.createdAt).toLocaleString(undefined, {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default AnnouncementItem;