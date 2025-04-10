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
import { useAuth } from "../../hooks/useAuth";

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
  const { isAdmin } = useAuth();
  
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

  const loadAnnouncements = async () => {
    try {
      const data: Announcement[] = await fetchAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    }
  };

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

  // Long press to enter selection mode
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

      // Call bulk delete API
      // await deleteBulkAnnouncements(idsToDelete);

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
      {isSelectionMode && (
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

      <Text className="text-xl font-bold mb-4">Announcements</Text>

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
      />

      {/* Create Announcement Button */}
      <TouchableOpacity
        onPress={() => router.replace("/(tabs)/CreateAnnouncement")}
        className="bg-blue-500 p-3.5 rounded-lg items-center mt-4 mb-4"
      >
        <Text className="text-white font-bold text-base">
          Create Announcement
        </Text>
      </TouchableOpacity>

      {/* Existing Modal Code Remains the Same */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={toggleModal}
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

            {/* Likes and Dislikes */}
            <View className="flex-row justify-between items-center px-4 py-3 border-t border-gray-200">
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => handleLike(selectedAnnouncement.id, "like")}
                  className="flex-row items-center mr-6"
                >
                  <Text className="text-xl mr-2">👍</Text>
                  <Text className="text-base font-medium">
                    {selectedAnnouncement.likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleLike(selectedAnnouncement.id, "dislike")}
                  className="flex-row items-center"
                >
                  <Text className="text-xl mr-2">👎</Text>
                  <Text className="text-base font-medium">
                    {selectedAnnouncement.dislikes}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
};

export default Announcements;
