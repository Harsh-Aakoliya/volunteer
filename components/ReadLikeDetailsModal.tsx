// components/ReadLikeDetailsModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  PanGestureHandler,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatISTDate, formatISTTime } from "@/utils/dateUtils";
import { getReadUsers, getLikedUsers } from "@/api/admin";

interface ReadLikeDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'read' | 'like';
  announcementId: number;
  departmentTag?: string[];
  onSwitchTab?: (type: 'read' | 'like') => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

interface ReadUser {
  userId: string;
  fullName: string;
  readAt: string;
  department?: string;
}

interface LikeUser {
  userId: string;
  fullName: string;
  likedAt: string;
  department?: string;
}

interface UnreadUser {
  userId: string;
  fullName: string;
  department: string;
}

const ReadLikeDetailsModal: React.FC<ReadLikeDetailsModalProps> = ({
  visible,
  onClose,
  type,
  announcementId,
  departmentTag = [],
  onSwitchTab,
  onRefresh,
  isRefreshing = false
}) => {
  const [readUsers, setReadUsers] = useState<ReadUser[]>([]);
  const [unreadUsers, setUnreadUsers] = useState<UnreadUser[]>([]);
  const [likeUsers, setLikeUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<'read' | 'like'>(type);

  useEffect(() => {
    setCurrentType(type);
  }, [type]);

  useEffect(() => {
    if (visible && announcementId) {
      fetchAllData();
    }
  }, [visible, announcementId]);

  const fetchAllData = async () => {
    await Promise.all([fetchReadDetails(), fetchLikeDetails()]);
  };

  const fetchReadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const readData = await getReadUsers(announcementId);
      
      if (readData) {
        if (readData.readUsers) {
          setReadUsers(readData.readUsers);
        }
        if (readData.unreadUsers) {
          setUnreadUsers(readData.unreadUsers);
        }
      }
      
    } catch (err) {
      console.error('Error fetching read details:', err);
      setError('Failed to load read details');
    } finally {
      setLoading(false);
    }
  };

  const fetchLikeDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const likeData = await getLikedUsers(announcementId);
      
      if (likeData && likeData.likedUsers) {
        setLikeUsers(likeData.likedUsers);
      }
      
    } catch (err) {
      console.error('Error fetching like details:', err);
      setError('Failed to load like details');
    } finally {
      setLoading(false);
    }
  };

  const formatReadTime = (readAt: string) => {
    const readDate = new Date(readAt);
    const now = new Date();
    const diffInMs = now.getTime() - readDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return formatISTDate(readAt, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };
  const refreshDetails = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      fetchAllData();
    }
  };

  const handleTabSwitch = (newType: 'read' | 'like') => {
    setCurrentType(newType);
    if (onSwitchTab) {
      onSwitchTab(newType);
    }
  };

  const formatLikeTime = (likedAt: string) => {
    const likeDate = new Date(likedAt);
    const now = new Date();
    const diffInMs = now.getTime() - likeDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return formatISTDate(likedAt, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const sortReadUsersByDate = (users: ReadUser[]) => {
    return users.sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime());
  };

  const sortLikeUsersByDate = (users: LikeUser[]) => {
    return users.sort((a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime());
  };

  const renderReadDetails = () => (
    <ScrollView className="flex-1">
      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#007AFF" />
          <Text className="text-gray-500 mt-2">Loading read details...</Text>
        </View>
      ) : error ? (
        <View className="items-center py-8">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-red-500 mt-2 text-center">{error}</Text>
        </View>
      ) : (
        <View>
          {/* Read Users Section */}
          {readUsers.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-gray-900 mb-3 px-4">
                Read by ({readUsers.length})
              </Text>
              {sortReadUsersByDate(readUsers).map((user, index) => (
                <View key={index} className="flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
                  <View className="flex-1">
                    <Text className="text-gray-900 font-medium">{user.fullName}</Text>
                    <Text className="text-sm text-gray-500">{user.department || 'Unknown Department'}</Text>
                  </View>
                  <Text className="text-sm text-gray-500">
                    {formatReadTime(user.readAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Unread Users Section */}
          {unreadUsers.length > 0 && (
            <View>
              <Text className="text-lg font-semibold text-gray-900 mb-3 px-4">
                Unread by ({unreadUsers.length})
              </Text>
              {unreadUsers.map((user, index) => (
                <View key={index} className="flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
                  <View className="flex-1">
                    <Text className="text-gray-500">{user.fullName}</Text>
                    <Text className="text-sm text-gray-400">{user.department}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {readUsers.length === 0 && unreadUsers.length === 0 && (
            <View className="items-center py-8">
              <Ionicons name="eye-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-500 mt-2">No read data available</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderLikeDetails = () => (
    <ScrollView className="flex-1">
      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#007AFF" />
          <Text className="text-gray-500 mt-2">Loading like details...</Text>
        </View>
      ) : error ? (
        <View className="items-center py-8">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-red-500 mt-2 text-center">{error}</Text>
        </View>
      ) : (
        <View>
          {likeUsers.length > 0 ? (
            <View>
              <Text className="text-lg font-semibold text-gray-900 mb-3 px-4">
                Liked by ({likeUsers.length})
              </Text>
              {sortLikeUsersByDate(likeUsers).map((user, index) => (
                <View key={index} className="flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
                  <View className="flex-1">
                    <Text className="text-gray-900 font-medium">{user.fullName}</Text>
                    <Text className="text-sm text-gray-500">{user.department || 'Unknown Department'}</Text>
                  </View>
                  <Text className="text-sm text-gray-500">
                    {formatLikeTime(user.likedAt)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center py-8">
              <Ionicons name="heart-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-500 mt-2">No likes yet</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

    return (
        <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
        >
        <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
            {/* Back button */}
            <TouchableOpacity
                onPress={onClose}
                className="p-2"
            >
                <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            
            {/* Title */}
            <Text className="text-lg font-semibold text-gray-900 flex-1 text-center">
                Analytics
            </Text>
    
            {/* Refresh button */}
            <TouchableOpacity
                onPress={refreshDetails}
                disabled={isRefreshing}
                className="p-2"
            >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#374151" />
                ) : (
                  <Ionicons name="refresh" size={24} color="#374151" />
                )}
            </TouchableOpacity>
            </View>

            {/* Tab Bar */}
            <View className="flex-row border-b border-gray-200">
              <TouchableOpacity
                onPress={() => handleTabSwitch('read')}
                className={`flex-1 py-3 items-center ${currentType === 'read' ? 'border-b-2 border-blue-500' : ''}`}
              >
                <Text className={`font-medium ${currentType === 'read' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Read ({readUsers.length + unreadUsers.length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => handleTabSwitch('like')}
                className={`flex-1 py-3 items-center ${currentType === 'like' ? 'border-b-2 border-blue-500' : ''}`}
              >
                <Text className={`font-medium ${currentType === 'like' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Likes ({likeUsers.length})
                </Text>
              </TouchableOpacity>
            </View>
    
            {/* Content */}
            {currentType === 'read' ? renderReadDetails() : renderLikeDetails()}
        </SafeAreaView>
        </Modal>
    );
};

export default ReadLikeDetailsModal;
