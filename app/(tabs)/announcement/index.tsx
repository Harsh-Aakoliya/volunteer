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
} from "react-native";
import {
  fetchAnnouncements,
  updateLikes,
  deleteAnnouncement,
  
} from "@/api/admin";
import { router } from "expo-router";
import { cssInterop } from "nativewind";
import WebView from "react-native-webview";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getPreviewHTML } from "@/components/HtmlPreview";
import { AuthStorage } from "@/utils/authStorage";
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

interface Announcement {
  id: number;
  title: string;
  body: string;
  authorId:string;
  created_at: string;
  likes: number;
  dislikes: number;
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
  const [isrefereshing,setIsrefereshing]=useState(false);
  // New state for selection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<{[key: number]: boolean}>({});


  useEffect(() => {
    loadAnnouncements();
  }, []);

  const router = useRouter();
  const { newAnnouncement } = useLocalSearchParams();

  useEffect(() => {
    if (typeof newAnnouncement === "string") {
      setAnnouncements((prev) => [JSON.parse(newAnnouncement), ...prev]);
    }
  }, [newAnnouncement]);
  // Check admin status on component mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      const userData = await AuthStorage.getUser();

      setIsAdmin(userData?.isAdmin || false);
    };

    checkAdminStatus();
  }, []);
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
  const onRefresh =useCallback(() => {
      setIsrefereshing(true);
      loadAnnouncements();
  }, []);

  const handleLike = async (id: number, type: "like" | "dislike") => {
    try {
      await updateLikes(id, type);
      loadAnnouncements();

      if (selectedAnnouncement && selectedAnnouncement.id === id) {
        const updated = announcements.find((a) => a.id === id);
        if (updated) {
          setSelectedAnnouncement(updated);
        }
      }
    } catch (error) {
      console.error(`Error updating ${type}:`, error);
    }
  };

  const openAnnouncement = (announcement: Announcement) => {
    if (!isSelectionMode) {
      setSelectedAnnouncement(announcement);
      setModalVisible(true);
    }
  };

  const handleDeleteAnnouncement = (id: number) => {
    deleteAnnouncement(id);
  };

  const toggleModal = () => {
    setModalVisible(!modalVisible);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleLongPress = () => {
    if (isAdmin) {
      setIsSelectionMode(true);
    }
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
      // Get selected announcement IDs
      const idsToDelete = Object.keys(selectedAnnouncements)
        .filter(id => selectedAnnouncements[parseInt(id)])
        .map(id => parseInt(id));

      // Call bulk delete API or individual delete
      for (const id of idsToDelete) {
        await deleteAnnouncement(id);
      }

      // Reload announcements
      loadAnnouncements();

      // Reset selection mode
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

      {/* <Text className="text-xl font-bold mb-4">Announcements</Text> */}

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
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
              <View className="p-4 bg-white mb-3 rounded-xl shadow-sm border border-gray-100">
                <Text className="text-lg font-bold mb-1 text-gray-900">
                  {item.title}
                </Text>
                <Text className="text-xs text-gray-500 mb-2">
                  {formatDateTime(item.created_at)}
                </Text>

                <View className="h-16 overflow-hidden mb-2">
                  <StyledWebView
                    className="flex-1"
                    originWhitelist={["*"]}
                    source={{ html: getPreviewHTML(item.body, true) }}
                    scrollEnabled={false}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={isrefereshing}
            onRefresh={onRefresh}
            colors={["#0284c7"]}
          />
        }
      />

      {/* Create Announcement Button (conditionally render for admin) */}
      {isAdmin && (
        <TouchableOpacity
          onPress={() => router.push("../create-announcement")}
          className="bg-blue-500 p-3.5 rounded-lg items-center mt-4 mb-4"
        >
          <Text className="text-white font-bold text-base">
            Create Announcement
          </Text>
        </TouchableOpacity>
      )}

      {/* Modal remains the same */}
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
                {formatDateTime(selectedAnnouncement.created_at)}
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


            {/* Admin Actions */}
            {isAdmin && selectedAnnouncement && (
              <View className="flex-row justify-end items-center px-4 py-2 border-t border-gray-200">
                <TouchableOpacity
                  onPress={async () => {
                    // Check if current user is the author
                    const userData = await AuthStorage.getUser();
                    if (userData?.userId === selectedAnnouncement.authorId) {
                      toggleModal();
                      router.push({
                        pathname: "../create-announcement",
                        params: {  
                          announcementId: selectedAnnouncement.id,
                          title: selectedAnnouncement.title,
                          body: selectedAnnouncement.body
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
                    // Check if current user is the author
                    const userData = await AuthStorage.getUser();
                    if (userData?.userId === selectedAnnouncement.authorId) {
                      try {
                        await deleteAnnouncement(selectedAnnouncement.id);
                        toggleModal();
                        loadAnnouncements(); // Refresh the list
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
    </View>
  );
};

export default Announcements;
