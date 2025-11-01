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
        className="mx-4 my-2 rounded-2xl"
        style={{
          backgroundColor: isRead ? '#f1f5f9' : '#eef2ff',
          padding: 20,
        }}
      >
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="mt-2 text-gray-600 font-semibold">Opening announcement...</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => onOpenAnnouncement(item)}
      disabled={isAnnouncementOpening}
      className="mx-3 my-2 rounded-2xl"
      style={{
        backgroundColor: (isRead || isScheduled) ? '#ffffff' : '#eef2ff',
        borderWidth: (isRead || isScheduled) ? 1 : 2,
        borderColor: (isRead || isScheduled) ? '#e2e8f0' : '#c7d2fe',
        shadowColor: isUnreadForViewer ? '#6366f1' : '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isUnreadForViewer ? 0.15 : 0.08,
        shadowRadius: 8,
        elevation: isUnreadForViewer ? 6 : 3,
      }}
      activeOpacity={0.8}
    >
      {/* Content */}
      <View className="p-5">
        {/* Title and top-right icon in one row */}
        <View className="mb-3 flex-row items-start justify-between">
          <Text
            className="flex-1"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{
              fontSize: 18,
              fontWeight: isUnreadForViewer ? '800' : '700',
              color: isUnreadForViewer ? '#1e293b' : '#334155',
              letterSpacing: -0.3,
              lineHeight: 24,
            }}
          >
            {item.title}
          </Text>
          {item.status === 'scheduled' ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                // Handle scheduling details if needed
              }}
              className="ml-3 rounded-full p-2"
              style={{ backgroundColor: '#fef3c7' }}
            >
              <Ionicons name="time-outline" size={18} color="#f59e0b" />
            </TouchableOpacity>
          ) : isAuthor ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                // Show analytics modal with both read and like data
                onShowReadDetails?.(item.id, item.departmentTag);
              }}
              className="ml-3 rounded-full p-2"
              style={{ backgroundColor: '#ddd6fe' }}
            >
              <Ionicons name="stats-chart" size={18} color="#6366f1" />
            </TouchableOpacity>
          ) : isUnreadForViewer ? (
            <View 
              className="ml-3 rounded-full"
              style={{
                width: 12,
                height: 12,
                backgroundColor: '#ef4444',
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 4,
                elevation: 5,
              }}
            />
          ) : null}
        </View>

        {/* Body Preview (two lines) */}
        <Text 
          numberOfLines={2} 
          ellipsizeMode="tail"
          style={{
            fontSize: 15,
            fontWeight: isUnreadForViewer ? '600' : '500',
            color: isUnreadForViewer ? '#475569' : '#64748b',
            lineHeight: 22,
            letterSpacing: 0.1,
          }}
        >
          {item.body.replace(/<[^>]*>/g, '').substring(0, 300)}...
        </Text>

        {/* Footer: author left (maroon), timestamp right (blue) */}
        <View className="mt-3 flex-row items-center justify-between">
          <Text 
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: isUnreadForViewer ? '800' : '700',
              color: '#991b1b',
              letterSpacing: 0.2,
            }}
          >
            {/* {item.authorName} */}
            Sevak Karyalay
          </Text>
          <Text 
            style={{
              fontSize: 12,
              fontWeight: isUnreadForViewer ? '700' : '600',
              color: '#6366f1',
              letterSpacing: 0.2,
            }}
          >
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