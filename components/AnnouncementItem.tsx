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
  likingInProgress: Set<number>;
  onToggleLike: (id: number) => void;
  onOpenAnnouncement: (item: Announcement) => void;
  formatDateTime: (date: string) => string;
  isAnnouncementOpening: boolean;
  onShowReadDetails?: (announcementId: number, departmentTag?: string[]) => void;
  onShowLikeDetails?: (announcementId: number) => void;
}

const AnnouncementItem: React.FC<AnnouncementItemProps> = ({
  item,
  currentUserId,
  likingInProgress,
  onToggleLike,
  onOpenAnnouncement,
  formatDateTime,
  isAnnouncementOpening,
  onShowReadDetails,
  onShowLikeDetails,
}) => {
  const [imageUri, setImageUri] = useState<string>(
    item.hasCoverImage
      ? `${API_URL}/media/announcement/${item.id}/coverimage.jpg`
      : `${API_URL}/media/announcement/defaultcoverimage.png`
  );
  const [loading, setLoading] = useState(true);

  const isRead = item.readBy?.some(read => read.userId === currentUserId) || false;
  const isLiked = item.likedBy?.some(like => like.userId === currentUserId) || false;
  const isAuthor = item.authorId === currentUserId;

  const handleImageError = () => {
    // console.log(`⚠️ Cover image failed for announcement ${item.id}, falling back to default.`);
    setImageUri(`${API_URL}/media/announcement/defaultcoverimage.png`);
  };

  // For scheduled announcements, show different UI without read/like functionality
  if (item.status === 'scheduled') {
    return (
      <TouchableOpacity
        onPress={() => onOpenAnnouncement(item)}
        disabled={isAnnouncementOpening}
        className={`bg-white mx-4 my-2 rounded-lg shadow-sm border border-yellow-200 ${isAnnouncementOpening ? 'opacity-50' : ''}`}
        style={{ height: 120 }}
        activeOpacity={0.7}
      >
        {/* Large Timer Icon for Scheduled */}
        <View className="absolute top-3 right-3 bg-yellow-100 rounded-full p-3 z-10">
          <Ionicons name="time-outline" size={24} color="#f59e0b" />
        </View>

        {/* Horizontal Layout: Content */}
        <View className="flex-row h-full">
          {/* Content Section */}
          <View className="flex-1 p-3 pr-16 justify-between">
            {/* Top section: Title and Preview */}
            <View>
              {/* Title */}
              <Text
                className="text-sm font-bold text-gray-900"
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.title}
              </Text>
              
              {/* Body Preview */}
              <Text className="text-xs text-gray-600 mt-1" numberOfLines={2} ellipsizeMode="tail">
                {item.body.replace(/<[^>]*>/g, '').substring(0, 100)}...
              </Text>
            </View>

            {/* Bottom section: Author and Scheduled Time */}
            <View>
              <Text className="text-xs text-gray-500">
                By {item.authorName} • Scheduled for {formatDateTime(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // For published announcements, show normal UI with read/like functionality
  return (
    <View
      className={`bg-white mx-4 my-2 rounded-lg shadow-sm border ${isRead
          ? 'border-gray-200'
          : 'border-blue-200 shadow-md'
        }`}
      style={{ height: 120 }}
    >
      {/* Unread indicator */}
      {!isRead && (
        <View className="absolute top-3 right-3 w-3 h-3 bg-blue-500 rounded-full z-10" />
      )}

      {/* Horizontal Layout: Cover Image + Content */}
      <View className="flex-row h-full">
        {/* Content Section - Right side */}
        <View className="flex-1 p-3 justify-between">
          {/* Top section: Date and Author */}
          <View>
            {/* Title */}
            <TouchableOpacity
              onPress={() => onOpenAnnouncement(item)}
              className="mb-2"
            >
              <Text
                className={`text-sm font-bold ${isRead ? 'text-gray-700' : 'text-gray-900'
                  }`}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.title}
              </Text>
            </TouchableOpacity>

            {/* Body Preview */}
            <Text className="text-xs text-gray-600 mb-1" numberOfLines={2} ellipsizeMode="tail">
              {item.body.replace(/<[^>]*>/g, '').substring(0, 100)}...
            </Text>

            {/* Author and Date */}
            <Text className="text-xs text-gray-500">
              By {item.authorName} • {formatDateTime(item.createdAt)}
            </Text>
          </View>

          {/* Bottom section: Action buttons */}
          <View className="flex-row items-center justify-between">
            {/* Action buttons - Read | Like (only for authors) */}
            {isAuthor && (
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => onShowReadDetails?.(item.id, item.departmentTag)}
                  className="flex-row items-center"
                >
                  <Text className="text-sm text-blue-600 font-semibold">
                    Read ({item.readBy?.length || 0})
                  </Text>
                </TouchableOpacity>

                <Text className="text-gray-400 mx-3 text-sm">|</Text>

                <TouchableOpacity
                  onPress={() => onShowLikeDetails?.(item.id)}
                  className="flex-row items-center"
                >
                  <Text className="text-sm text-blue-600 font-semibold">
                    Like ({item.likedBy?.length || 0})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Like button for non-authors */}
            {!isAuthor && (
              <TouchableOpacity
                onPress={() => onToggleLike(item.id)}
                className="flex-row items-center"
                disabled={likingInProgress.has(item.id)}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={14}
                  color={likingInProgress.has(item.id) ? "#9ca3af" : (isLiked ? "#ef4444" : "#6b7280")}
                />
                <Text className="text-xs text-gray-500 ml-1">
                  {isLiked ? 'Liked' : 'Like'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

export default AnnouncementItem;