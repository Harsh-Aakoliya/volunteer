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
  TouchableHighlight,
  ViewStyle,
  RefreshControl,
  Alert,
} from "react-native";
import {
  fetchAnnouncements,
  updateLikes,
  deleteAnnouncement,
  toggleLike,
  markAsRead,
  getLikedUsers,
  getReadUsers,
  createDraft,
  getDrafts,
  deleteDraft,
  fetchAnnouncementsDebug,
} from "@/api/admin";
import { router } from "expo-router";
import { cssInterop } from "nativewind";
import WebView from "react-native-webview";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getPreviewHTML } from "@/components/HtmlPreview";
import { AuthStorage } from "@/utils/authStorage";
import { Announcement, LikedUser, ReadUser } from "@/types/type";
import { Ionicons } from '@expo/vector-icons';

// Custom Checkbox Component with TypeScript
interface CustomCheckboxProps { 
  checked: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ 
  checked, 
  onPress, 
  style 
}) => {
  return (
    <TouchableOpacity 
      onPress={onPress}
      style={[
        {
          width: 24,
          height: 24,
          borderWidth: 2,
          borderColor: 'gray',
          borderRadius: 4,
          justifyContent: 'center',
          alignItems: 'center'
        },
        style
      ]}
    >
      {checked && (
        <View 
          style={{
            width: 12,
            height: 12,
            backgroundColor: 'blue'
          }}
        />
      )}
    </TouchableOpacity>
  );
};

// Use cssInterop for WebView
const StyledWebView = cssInterop(WebView, {
  className: "style",
});

const Announcements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isrefereshing,setIsrefereshing]=useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // New state for selection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<{[key: number]: boolean}>({});

  // New states for like and read functionality
  const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);
  const [readUsers, setReadUsers] = useState<ReadUser[]>([]);
  const [showLikedUsers, setShowLikedUsers] = useState(false);
  const [showReadUsers, setShowReadUsers] = useState(false);

  // New states for draft functionality
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [drafts, setDrafts] = useState<Announcement[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);

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
      setIsrefereshing(false);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      setIsrefereshing(false);
    }
  };

  const loadAnnouncementsDebug = async () => {
    try {
      console.log("Loading debug announcements...");
      const data: Announcement[] = await fetchAnnouncementsDebug();
      console.log("Debug announcements loaded:", data.length);
      setAnnouncements(data); // Temporarily show all announcements
    } catch (error) {
      console.error("Error fetching debug announcements:", error);
    }
  };

  const onRefresh = useCallback(() => {
    setIsrefereshing(true);
    loadAnnouncements();
  }, []);

  const handleToggleLike = async (id: number) => {
    try {
      await toggleLike(id, currentUserId);
      loadAnnouncements(); // Refresh to get updated likes
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsRead(id, currentUserId);
      loadAnnouncements(); // Refresh to get updated read status
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const openAnnouncement = async (announcement: Announcement) => {
    if (!isSelectionMode) {
      // Mark as read when opening
      await handleMarkAsRead(announcement.id);
      setSelectedAnnouncement(announcement);
      setModalVisible(true);
    }
  };

  const handleDeleteAnnouncement = (id: number) => {
    deleteAnnouncement(id);
  };

  const toggleModal = () => {
    setModalVisible(!modalVisible);
    setShowLikedUsers(false);
    setShowReadUsers(false);
  };

  const handleLongPress = () => {
    if (isAdmin) {
      setIsSelectionMode(true);
    }
  };

  // Check if current user has read the announcement
  const hasUserRead = (announcement: Announcement) => {
    return announcement.readBy?.some(read => read.userId === currentUserId) || false;
  };

  // Check if current user has liked the announcement
  const hasUserLiked = (announcement: Announcement) => {
    return announcement.likes?.includes(currentUserId) || false;
  };

  // Toggle selection of an announcement
  const toggleAnnouncementSelection = (id: number) => {
    setSelectedAnnouncements(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Bulk delete selected announcements
  const handleBulkDelete = async () => {
    try {
      const idsToDelete = Object.keys(selectedAnnouncements)
        .filter(id => selectedAnnouncements[parseInt(id)])
        .map(id => parseInt(id));

      for (const id of idsToDelete) {
        await deleteAnnouncement(id);
      }

      loadAnnouncements();
      cancelSelectionMode();
    } catch (error) {
      console.error('Error deleting announcements:', error);
    }
  };

  // Cancel selection mode
  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedAnnouncements({});
  };

  // Load liked users
  const loadLikedUsers = async (id: number) => {
    try {
      const result = await getLikedUsers(id);
      setLikedUsers(result.likedUsers || []);
      setShowLikedUsers(true);
    } catch (error) {
      console.error("Error loading liked users:", error);
    }
  };

  // Load read users
  const loadReadUsers = async (id: number) => {
    try {
      const result = await getReadUsers(id);
      setReadUsers(result.readUsers || []);
      setShowReadUsers(true);
    } catch (error) {
      console.error("Error loading read users:", error);
    }
  };

  // Draft management functions
  const handleCreateNewAnnouncement = async () => {
    try {
      setShowCreateOptions(false);
      const draft = await createDraft(currentUserId);
      console.log("Draft created:", draft);
      router.push({
        pathname: "../create-announcement",
        params: {
          announcementId: draft.id,
          title:'',
          content: '',
          announcementMode: 'fresh'
        }
      });
    } catch (error) {
      console.error("Error creating draft:", error);
      Alert.alert("Error", "Failed to create new announcement");
    }
  };

  const handleCreateFromDraft = async () => {
    try {
      setShowCreateOptions(false);
      setIsLoadingDrafts(true);
      const userDrafts = await getDrafts(currentUserId);
      setDrafts(userDrafts);
      setShowDraftModal(true);
    } catch (error) {
      console.error("Error loading drafts:", error);
      Alert.alert("Error", "Failed to load drafts");
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const handleSelectDraft = (draft: Announcement) => {
    setShowDraftModal(false);
    console.log("Draft selected:", draft);
    router.push({
      pathname: "../create-announcement",
      params: {
        announcementId: draft.id,
        title: draft.title || '',
        content: draft.body || '',
        announcementMode: 'draft'
      }
    });
  };

  const handleDeleteDraft = async (draftId: number) => {
    try {
      await deleteDraft(draftId, currentUserId);
      const updatedDrafts = await getDrafts(currentUserId);
      setDrafts(updatedDrafts);
    } catch (error) {
      console.error("Error deleting draft:", error);
      Alert.alert("Error", "Failed to delete draft");
    }
  };
const formatDateTime = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
  return (
    <View className="flex-1 px-4 py-4">
      {/* Bulk Delete Options */}
      {isSelectionMode && isAdmin && (
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={cancelSelectionMode}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleBulkDelete}
            disabled={Object.values(selectedAnnouncements).filter(Boolean).length === 0}
          >
            <Text>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const isRead = hasUserRead(item);
          const isLiked = hasUserLiked(item);
          
          return (
            <TouchableOpacity 
              className="flex-row items-center"
              onLongPress={handleLongPress}
            >
              {/* Checkbox in selection mode */}
              {isSelectionMode && (
                <CustomCheckbox
                  checked={selectedAnnouncements[item.id] || false}
                  onPress={() => toggleAnnouncementSelection(item.id)}
                  style={{ marginRight: 10 }}
                />
              )}

              <TouchableOpacity 
                className="flex-1"
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
                    {formatDateTime(item.createdAt)}
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
                      <View className="flex-row items-center">
                        <Ionicons 
                          name={isLiked ? "heart" : "heart-outline"} 
                          size={16} 
                          color={isLiked ? "#ef4444" : "#6b7280"} 
                        />
                        <Text className="text-xs text-gray-500 ml-1">
                          {item.likes?.length || 0}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Ionicons name="eye-outline" size={16} color="#6b7280" />
                        <Text className="text-xs text-gray-500 ml-1">
                          {item.readBy?.length || 0}
                        </Text>
                      </View>
                    </View>
                    {!isRead && (
                      <Text className="text-xs font-semibold text-blue-600">NEW</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={isrefereshing}
            onRefresh={onRefresh}
            colors={["#0284c7"]}
          />
        }
      />

      {/* Floating + Button (conditionally render for admin) */}
      {isAdmin && (
        <TouchableOpacity
          onPress={() => setShowCreateOptions(true)}
          className="absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          style={{ elevation: 8 }}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}

      {/* Create Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCreateOptions}
        onRequestClose={() => setShowCreateOptions(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-lg p-6 w-4/5 max-w-sm">
            <Text className="text-lg font-bold mb-4 text-center">Create Announcement</Text>
            
            <TouchableOpacity
              onPress={handleCreateNewAnnouncement}
              className="bg-blue-500 py-3 px-4 rounded-lg mb-3"
            >
              <Text className="text-white font-semibold text-center">Create New Announcement</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleCreateFromDraft}
              className="bg-green-500 py-3 px-4 rounded-lg mb-3"
            >
              <Text className="text-white font-semibold text-center">Create from Draft</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setShowCreateOptions(false)}
              className="bg-gray-300 py-3 px-4 rounded-lg"
            >
              <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Drafts Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showDraftModal}
        onRequestClose={() => setShowDraftModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <StatusBar barStyle="dark-content" />
          
          {/* Modal Header */}
          <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
            <Text className="text-xl font-bold">Your Drafts</Text>
            <TouchableOpacity
              className="bg-gray-200 py-2 px-4 rounded-lg"
              onPress={() => setShowDraftModal(false)}
            >
              <Text className="text-gray-800">Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Drafts List */}
          <FlatList
            data={drafts}
            keyExtractor={(item) => item.id.toString()}
            className="flex-1 px-4"
            renderItem={({ item }) => (
              <View className="bg-gray-50 p-4 mb-3 rounded-lg border border-gray-200">
                <View className="flex-row justify-between items-start">
                  <TouchableOpacity
                    onPress={() => handleSelectDraft(item)}
                    className="flex-1 mr-3"
                  >
                    <Text className="text-lg font-semibold text-gray-900 mb-1">
                      {item.title || 'Untitled Draft'}
                    </Text>
                    <Text className="text-sm text-gray-500 mb-2">
                      Last updated: {formatDateTime(item.updatedAt)}
                    </Text>
                    <Text className="text-gray-700" numberOfLines={3}>
                      {item.body ? item.body.replace(/<[^>]*>/g, '') : 'No content'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        "Delete Draft",
                        "Are you sure you want to delete this draft?",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: () => handleDeleteDraft(item.id) }
                        ]
                      );
                    }}
                    className="bg-red-100 p-2 rounded-lg"
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-12">
                <Ionicons name="document-outline" size={64} color="#9ca3af" />
                <Text className="text-gray-500 text-center mt-4">No drafts found</Text>
                <Text className="text-gray-400 text-center mt-2">Create your first draft to get started</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

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
                {formatDateTime(selectedAnnouncement.createdAt)}
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
                >
                  <Ionicons 
                    name={hasUserLiked(selectedAnnouncement) ? "heart" : "heart-outline"} 
                    size={24} 
                    color={hasUserLiked(selectedAnnouncement) ? "#ef4444" : "#6b7280"} 
                  />
                  <Text className="ml-2 text-gray-700">
                    {selectedAnnouncement.likes?.length || 0} likes
                  </Text>
                </TouchableOpacity>

                {/* Author-only options */}
                {isAdmin && selectedAnnouncement.authorId === currentUserId && (
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
            {isAdmin && selectedAnnouncement && (
              <View className="flex-row justify-end items-center px-4 py-2 border-t border-gray-200">
                <TouchableOpacity
                  onPress={async () => {
                    const userData = await AuthStorage.getUser();
                    if (userData?.userId === selectedAnnouncement.authorId) {
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
                    } else {
                      alert("You can only edit your own announcements");
                    }
                  }}
                  className="bg-blue-500 py-2 px-4 rounded-lg mr-2"
                >
                  <Text className="text-white">Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    const userData = await AuthStorage.getUser();
                    if (userData?.userId === selectedAnnouncement.authorId) {
                      try {
                        await deleteAnnouncement(selectedAnnouncement.id);
                        toggleModal();
                        loadAnnouncements();
                      } catch (error) {
                        console.error("Error deleting announcement:", error);
                        alert("Failed to delete announcement");
                      }
                    } else {
                      alert("You can only delete your own announcements");
                    }
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
                    Read on {formatDateTime(item.readAt)}
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
