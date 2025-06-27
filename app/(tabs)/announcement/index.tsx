import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  SafeAreaView,

  RefreshControl,
  Alert,
} from "react-native";
import {
  fetchAnnouncements,
  deleteAnnouncement,
  toggleLike,
  markAsRead,
  getLikedUsers,
  getReadUsers,
} from "@/api/admin";
import { router } from "expo-router";
import { cssInterop } from "nativewind";
import WebView from "react-native-webview";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getPreviewHTML } from "@/components/HtmlPreview";
import { AuthStorage } from "@/utils/authStorage";
import { Ionicons } from '@expo/vector-icons';

interface Announcement {
  id: number;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  likedBy: Array<{
    userId: string;
    fullName: string;
    likedAt: string;
  }>;
  readBy: Array<{
    userId: string;
    fullName: string;
    readAt: string;
  }>;
}

interface LikedUser {
  userId: string;
  fullName: string;
  likedAt: string;
}

interface ReadUser {
  userId: string;
  fullName: string;
  readAt: string;
}

// Use cssInterop for WebView
const StyledWebView = cssInterop(WebView, {
  className: "style",
});

const Announcements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // New states for like and read functionality
  const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);
  const [readUsers, setReadUsers] = useState<ReadUser[]>([]);
  const [showLikedUsers, setShowLikedUsers] = useState(false);
  const [showReadUsers, setShowReadUsers] = useState(false);
  const [likingInProgress, setLikingInProgress] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadAnnouncements();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const userData = await AuthStorage.getUser();
    if (userData) {
      setCurrentUserId(userData.userId);
      setIsAdmin(userData.isAdmin || false);
    }
  };

  const router = useRouter();
  const { newAnnouncement } = useLocalSearchParams();

  useEffect(() => {
    if (typeof newAnnouncement === "string") {
      setAnnouncements((prev) => [JSON.parse(newAnnouncement), ...prev]);
    }
  }, [newAnnouncement]);

  const loadAnnouncements = async () => {
    try {
      const data: Announcement[] = await fetchAnnouncements();
      setAnnouncements(data);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      setIsRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadAnnouncements();
  }, []);

  const handleToggleLike = async (id: number) => {
    // Prevent multiple rapid clicks
    if (likingInProgress.has(id)) {
      return;
    }

    try {
      // Mark as in progress
      setLikingInProgress(prev => new Set(prev.add(id)));

      // Optimistically update the UI first for immediate feedback
      setAnnouncements(prevAnnouncements => 
        prevAnnouncements.map(announcement => {
          if (announcement.id === id) {
            const currentlyLiked = announcement.likedBy?.some(like => like.userId === currentUserId) || false;
            let newLikedBy;
            
            if (currentlyLiked) {
              // Remove user's like
              newLikedBy = announcement.likedBy?.filter(like => like.userId !== currentUserId) || [];
            } else {
              // Add user's like
              const newLike = {
                userId: currentUserId,
                fullName: 'You', // We'll get actual name from server response
                likedAt: new Date().toISOString()
              };
              newLikedBy = [...(announcement.likedBy || []), newLike];
            }
            
            return {
              ...announcement,
              likedBy: newLikedBy
            };
          }
          return announcement;
        })
      );

      // Also update selected announcement if it's the same one
      if (selectedAnnouncement && selectedAnnouncement.id === id) {
        const currentlyLiked = selectedAnnouncement.likedBy?.some(like => like.userId === currentUserId) || false;
        let newLikedBy;
        
        if (currentlyLiked) {
          newLikedBy = selectedAnnouncement.likedBy?.filter(like => like.userId !== currentUserId) || [];
        } else {
          const newLike = {
            userId: currentUserId,
            fullName: 'You',
            likedAt: new Date().toISOString()
          };
          newLikedBy = [...(selectedAnnouncement.likedBy || []), newLike];
        }
        
        setSelectedAnnouncement({
          ...selectedAnnouncement,
          likedBy: newLikedBy
        });
      }

      // Send request to server
      const result = await toggleLike(id, currentUserId);
      console.log('Like toggle result:', result);
      
      // Success! The optimistic update should be correct
      // We could optionally refresh to get accurate server data
      
    } catch (error: any) {
      console.error("Error toggling like:", error);
      
      // Revert optimistic update on error
      loadAnnouncements();
      
      // Show error message
      Alert.alert("Error", "Failed to update like. Please try again.");
    } finally {
      // Remove from in progress
      setLikingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const result = await markAsRead(id, currentUserId);
      if (result.wasNew) {
        loadAnnouncements(); // Refresh to get updated read status
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const openAnnouncement = async (announcement: Announcement) => {
    // Mark as read when opening
    await handleMarkAsRead(announcement.id);
    setSelectedAnnouncement(announcement);
    setModalVisible(true);
  };

  const toggleModal = () => {
    setModalVisible(!modalVisible);
    setShowLikedUsers(false);
    setShowReadUsers(false);
  };

  // Check if current user has read the announcement
  const hasUserRead = (announcement: Announcement) => {
    return announcement.readBy?.some(read => read.userId === currentUserId) || false;
  };

  // Check if current user has liked the announcement
  const hasUserLiked = (announcement: Announcement) => {
    return announcement.likedBy?.some(like => like.userId === currentUserId) || false;
  };

  // Load liked users (only for authors)
  const loadLikedUsers = async (id: number) => {
    try {
      const result = await getLikedUsers(id, currentUserId);
      setLikedUsers(result.likedUsers || []);
      setShowLikedUsers(true);
    } catch (error: any) {
      console.error("Error loading liked users:", error);
      if (error.response?.status === 403) {
        Alert.alert("Unauthorized", "Only the author can view who liked this announcement");
      }
    }
  };

  // Load read users (only for authors)
  const loadReadUsers = async (id: number) => {
    try {
      const result = await getReadUsers(id, currentUserId);
      setReadUsers(result.readUsers || []);
      setShowReadUsers(true);
    } catch (error: any) {
      console.error("Error loading read users:", error);
      if (error.response?.status === 403) {
        Alert.alert("Unauthorized", "Only the author can view who read this announcement");
      }
    }
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTimeWithTime = (date: string) => {
    const dateObj = new Date(date);
    
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istDate = new Date(dateObj.getTime() + istOffset);
    
    const day = istDate.getUTCDate().toString().padStart(2, '0');
    const month = (istDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = istDate.getUTCFullYear();
    
    let hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
  };

  return (
    <View className="flex-1 px-4 py-4">
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const isRead = hasUserRead(item);
          const isLiked = hasUserLiked(item);
          
          return (
            <TouchableOpacity 
              onPress={() => openAnnouncement(item)}
            >
              <View className={`p-4 mb-3 rounded-xl shadow-sm border ${
                isRead 
                  ? 'bg-gray-50 border-gray-200' 
                  : 'bg-white border-blue-200 shadow-md'
              }`}>
                {/* Unread indicator */}
                {!isRead && (
                  <View className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full" />
                )}
                
                <Text className={`text-lg font-bold mb-1 ${
                  isRead ? 'text-gray-700' : 'text-gray-900'
                }`}>
                  {item.title}
                </Text>
                <Text className="text-xs text-gray-500 mb-2">
                  By {item.authorName} • {formatDateTime(item.createdAt)}
                </Text>

                <View className="h-16 overflow-hidden mb-2">
                  <StyledWebView
                    className="flex-1"
                    originWhitelist={["*"]}
                    source={{ html: getPreviewHTML(item.body, true) }}
                    scrollEnabled={false}
                  />
                </View>

                {/* Like and Read count indicators */}
                <View className="flex-row justify-between items-center mt-2">
                  <View className="flex-row items-center space-x-4">
                    {/* Like button - always show */}
                    <TouchableOpacity 
                      onPress={() => handleToggleLike(item.id)}
                      className="flex-row items-center"
                      disabled={likingInProgress.has(item.id)}
                    >
                      <Ionicons 
                        name={isLiked ? "heart" : "heart-outline"} 
                        size={16} 
                        color={likingInProgress.has(item.id) ? "#9ca3af" : (isLiked ? "#ef4444" : "#6b7280")} 
                      />
                      {/* Show count only for authors */}
                      {item.authorId === currentUserId && (
                        <Text className="text-xs text-gray-500 ml-1">
                          {item.likedBy?.length || 0}
                        </Text>
                      )}
                    </TouchableOpacity>
                    
                    {/* Read count - only show for authors */}
                    {item.authorId === currentUserId && (
                      <View className="flex-row items-center">
                        <Ionicons name="eye-outline" size={16} color="#6b7280" />
                        <Text className="text-xs text-gray-500 ml-1">
                          {item.readBy?.length || 0}
                        </Text>
                      </View>
                    )}
                  </View>
                  {!isRead && (
                    <Text className="text-xs font-semibold text-blue-600">NEW</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#0284c7"]}
          />
        }
      />

      {/* Floating + Button (conditionally render for admin) */}
      {isAdmin && (
        <TouchableOpacity
          onPress={() => {
            router.push({
              pathname: "../create-announcement",
              params: {
                announcementMode: 'new'
              }
            });
          }}
          className="absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          style={{ elevation: 8 }}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}

      {/* Modal for announcement details */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        {selectedAnnouncement && (
          <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            {/* Modal Header */}
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
              <Text className="text-xl font-bold">Announcement</Text>
              <TouchableOpacity
                className="bg-gray-200 py-2 px-4 rounded-lg"
                onPress={toggleModal}
              >
                <Text className="text-gray-800">Close</Text>
              </TouchableOpacity>
            </View>

            {/* Title and Date */}
            <View className="px-4 py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {selectedAnnouncement.title}
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                By {selectedAnnouncement.authorName} • {formatDateTime(selectedAnnouncement.createdAt)}
              </Text>
            </View>

            {/* Content */}
            <View className="flex-1 border-t border-gray-200 pt-2">
              <StyledWebView
                className="flex-1"
                originWhitelist={["*"]}
                source={{ html: getPreviewHTML(selectedAnnouncement.body) }}
                showsVerticalScrollIndicator={true}
              />
            </View>

            {/* Like and interaction section */}
            <View className="px-4 py-3 border-t border-gray-200">
              <View className="flex-row justify-between items-center">
                {/* Like button */}
                <TouchableOpacity
                  onPress={() => handleToggleLike(selectedAnnouncement.id)}
                  className="flex-row items-center"
                  disabled={likingInProgress.has(selectedAnnouncement.id)}
                >
                  <Ionicons 
                    name={hasUserLiked(selectedAnnouncement) ? "heart" : "heart-outline"} 
                    size={24} 
                    color={likingInProgress.has(selectedAnnouncement.id) ? "#9ca3af" : (hasUserLiked(selectedAnnouncement) ? "#ef4444" : "#6b7280")} 
                  />
                  {/* Show count only for authors */}
                  {selectedAnnouncement.authorId === currentUserId && (
                    <Text className="ml-2 text-gray-700">
                      {selectedAnnouncement.likedBy?.length || 0} likes
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Author-only options */}
                {selectedAnnouncement.authorId === currentUserId && (
                  <View className="flex-row space-x-2">
                    <TouchableOpacity
                      onPress={() => loadLikedUsers(selectedAnnouncement.id)}
                      className="bg-blue-100 py-2 px-3 rounded-lg"
                    >
                      <Text className="text-blue-700 text-sm">Who Liked</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => loadReadUsers(selectedAnnouncement.id)}
                      className="bg-green-100 py-2 px-3 rounded-lg"
                    >
                      <Text className="text-green-700 text-sm">Who Read</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Admin Actions */}
            {isAdmin && selectedAnnouncement.authorId === currentUserId && (
              <View className="flex-row justify-end items-center px-4 py-2 border-t border-gray-200">
                <TouchableOpacity
                  onPress={() => {
                    toggleModal();
                    router.push({
                      pathname: "../create-announcement",
                      params: {  
                        announcementId: selectedAnnouncement.id,
                        title: selectedAnnouncement.title,
                        content: selectedAnnouncement.body,
                        announcementMode: 'edit'
                      }
                    });
                  }}
                  className="bg-blue-500 py-2 px-4 rounded-lg mr-2"
                >
                  <Text className="text-white">Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    Alert.alert(
                      "Delete Announcement",
                      "Are you sure you want to delete this announcement?",
                      [
                        { text: "Cancel", style: "cancel" },
                        { 
                          text: "Delete", 
                          style: "destructive", 
                          onPress: async () => {
                            try {
                              await deleteAnnouncement(selectedAnnouncement.id);
                              toggleModal();
                              loadAnnouncements();
                            } catch (error) {
                              console.error("Error deleting announcement:", error);
                              Alert.alert("Error", "Failed to delete announcement");
                            }
                          }
                        }
                      ]
                    );
                  }}
                  className="bg-red-500 py-2 px-4 rounded-lg"
                >
                  <Text className="text-white">Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        )}
      </Modal>

      {/* Liked Users Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showLikedUsers}
        onRequestClose={() => setShowLikedUsers(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-lg p-4 w-4/5 max-h-96">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold">Users who liked this</Text>
              <TouchableOpacity onPress={() => setShowLikedUsers(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={likedUsers}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <View className="py-2 border-b border-gray-100">
                  <Text className="text-gray-900">{item.fullName}</Text>
                  <Text className="text-xs text-gray-500">
                    Liked on {formatDateTimeWithTime(item.likedAt)}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <Text className="text-gray-500 text-center py-4">No likes yet</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Read Users Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showReadUsers}
        onRequestClose={() => setShowReadUsers(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-lg p-4 w-4/5 max-h-96">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold">Users who read this</Text>
              <TouchableOpacity onPress={() => setShowReadUsers(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={readUsers}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <View className="py-2 border-b border-gray-100">
                  <Text className="text-gray-900">{item.fullName}</Text>
                  <Text className="text-xs text-gray-500">
                    Read on {formatDateTimeWithTime(item.readAt)}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <Text className="text-gray-500 text-center py-4">No reads yet</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Announcements;