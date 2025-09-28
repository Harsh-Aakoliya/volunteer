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
}

const   AnnouncementItem: React.FC<AnnouncementItemProps> = ({
  item,
  currentUserId,
  likingInProgress,
  onToggleLike,
  onOpenAnnouncement,
  formatDateTime,
  isAnnouncementOpening,
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

  return (
    <View 
      className={`bg-white mx-4 my-2 rounded-lg shadow-sm border ${
        isRead 
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
        {/* Cover Image - Square on the left */}
        <TouchableOpacity 
    onPress={() => {
        if (!isAnnouncementOpening) {
            onOpenAnnouncement(item);
        } 
    }}
    disabled={isAnnouncementOpening} // 👈 Disable interaction during navigation
    className="relative"
>
          <View className="w-[120px] h-[120px] bg-gray-200 rounded-l-lg overflow-hidden">
            <RNImage
              key={item.id}
              source={{ uri: imageUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onError={handleImageError}
              onLoadEnd={() => setLoading(false)}
            />
            {loading && (
              <View className="absolute inset-0 bg-gray-300 flex items-center justify-center">
                <ActivityIndicator size="small" color="#6b7280" />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Content Section - Right side */}
        <View className="flex-1 p-3 justify-between">
          {/* Top section: Date and Author */}
          <View>
            <Text className="text-xs text-gray-500 mb-1" numberOfLines={1}>
              {formatDateTime(item.createdAt)} | {item.authorName}
            </Text>

            {/* Title */}
            <TouchableOpacity 
              onPress={() => onOpenAnnouncement(item)}
              className="mb-2"
            >
              <Text 
                className={`text-sm font-bold ${
                  isRead ? 'text-gray-700' : 'text-gray-900'
                }`}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom section: Action buttons */}
          <View className="flex-row items-center justify-between">
            {/* Action buttons - Read | Like (only for authors) */}
            {isAuthor && (
              <View className="flex-row items-center">
                <Text className="text-xs text-blue-600 font-medium">
                  Read ({item.readBy?.length || 0})
                </Text>
                
                <Text className="text-gray-400 mx-3 text-xs">|</Text>
                
                <Text className="text-xs text-blue-600 font-medium">
                  Like ({item.likedBy?.length || 0})
                </Text>
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