// app/chat/[roomId]/attachments.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  StyleSheet,
  Keyboard,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { BackHandler } from "react-native";

import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";
import { router, useLocalSearchParams } from "expo-router";
import { TabView, TabBar } from "react-native-tab-view";
import PollContent from "@/components/chat/PollContent";
import AnnouncementContent from "@/components/chat/AnnouncementContent";
import CameraScreen from "@/components/chat/CameraScreen";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// ---------- TYPES ----------
interface SelectedMedia {
  id: string;
  uri: string;
  filename: string;
  mediaType: "photo" | "video";
  duration?: number;
  order: number;
}

type TabType = "gallery" | "poll" | "announcement";
type GalleryItem = { type: "camera" } | { type: "media"; asset: MediaLibrary.Asset };

// ---------- ICONS ----------
const GalleryIcon = ({ size = 24, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
      fill={color}
    />
  </Svg>
);

const PollIcon = ({ size = 24, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"
      fill={color}
    />
  </Svg>
);

const AnnouncementIcon = ({ size = 24, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"
      fill={color}
    />
  </Svg>
);



// ---------- HELPER FUNCTIONS ----------
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getMimeType = (filename: string, mediaType: "photo" | "video"): string => {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (mediaType === "video") {
    switch (extension) {
      case "mp4": return "video/mp4";
      case "mov": return "video/quicktime";
      case "avi": return "video/x-msvideo";
      case "mkv": return "video/x-matroska";
      case "webm": return "video/webm";
      case "3gp": return "video/3gpp";
      default: return "video/mp4";
    }
  } else {
    switch (extension) {
      case "jpg":
      case "jpeg": return "image/jpeg";
      case "png": return "image/png";
      case "gif": return "image/gif";
      case "webp": return "image/webp";
      case "heic": return "image/heic";
      case "heif": return "image/heif";
      default: return "image/jpeg";
    }
  }
};

// ---------- CAMERA ITEM COMPONENT ----------
const CameraItem = React.memo(({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    style={[styles.mediaItem, styles.cameraContainer]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name="camera" size={32} color="#666" />
    <Text style={styles.cameraText}>Camera</Text>
  </TouchableOpacity>
));

// ---------- MEDIA ITEM COMPONENT ----------
const MediaItem = React.memo(({
  item,
  selectedOrder,
  onSelect,
}: {
  item: MediaLibrary.Asset;
  selectedOrder: number | null;
  onSelect: (asset: MediaLibrary.Asset) => void;
}) => {
  const isSelected = selectedOrder !== null;
  const isVideo = item.mediaType === "video";

  return (
    <TouchableOpacity
      style={styles.mediaItem}
      onPress={() => onSelect(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.mediaImage}
        resizeMode="cover"
      />
      
      {isVideo && (
        <View style={styles.videoOverlay}>
          <View style={styles.videoPlayIconContainer}>
            <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      )}
      
      {isVideo && (
        <View style={styles.durationBadge}>
          <Ionicons name="videocam" size={12} color="white" />
          <Text style={styles.durationText}>
            {formatDuration(item.duration || 0)}
          </Text>
        </View>
      )}

      <View style={[styles.selectionBubble, isSelected && styles.selectionBubbleSelected]}>
        {isSelected && (
          <Text style={styles.selectionNumber}>{selectedOrder}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ---------- MAIN COMPONENT ----------
export default function AttachmentsScreen() {
  const params = useLocalSearchParams();
  const roomId = params.roomId as string;
  const userId = params.userId as string;
  const layout = useWindowDimensions();
  
  const { sendMessage: socketSendMessage } = useSocket();

  // Tab view state
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'gallery', title: 'Gallery' },
    { key: 'poll', title: 'Poll' },
    // { key: 'announcement', title: 'Announcement' },
  ]);

  // Gallery state
  const [mediaAssets, setMediaAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [showCamera, setShowCamera] = useState(false);

  // Count selected photos and videos
  const selectedPhotosCount = useMemo(() => 
    selectedMedia.filter(m => m.mediaType === "photo").length, [selectedMedia]);
  const selectedVideosCount = useMemo(() => 
    selectedMedia.filter(m => m.mediaType === "video").length, [selectedMedia]);

  // Request permission and load media on mount
  useEffect(() => {
    if (hasPermission === null) {
      requestPermissionAndLoadMedia();
    }
  }, [hasPermission]);

  const requestPermissionAndLoadMedia = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === "granted");
      if (status === "granted") {
        loadMedia();
      }
    } catch (error) {
      console.error("Permission error:", error);
      setHasPermission(false);
    }
  };
  useEffect(() => {
    const backAction = () => {
      // Explicitly go to chat/[roomId]
      router.replace({
        pathname: "/chat/[roomId]",
        params: { roomId },
      });
      return true; // ⛔ prevent default back behavior
    };
  
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );
  
    return () => backHandler.remove();
  }, [roomId]);

  const loadMedia = async (cursor?: string) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: 30,
        after: cursor,
        mediaType: ["photo", "video"],
        sortBy: ["creationTime"],
      });
      if (cursor) {
        setMediaAssets(prev => [...prev, ...result.assets]);
      } else {
        setMediaAssets(result.assets);
      }
      setEndCursor(result.endCursor);
      setHasMore(result.hasNextPage);
    } catch (error) {
      console.error("Error loading media:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMedia = useCallback(() => {
    if (hasMore && !isLoading && endCursor) {
      loadMedia(endCursor);
    }
  }, [hasMore, isLoading, endCursor]);

  const handleSelectMedia = useCallback((asset: MediaLibrary.Asset) => {
    setSelectedMedia(prev => {
      const existingIndex = prev.findIndex(m => m.id === asset.id);
      if (existingIndex !== -1) {
        const newSelection = prev.filter(m => m.id !== asset.id);
        return newSelection.map((item, index) => ({ ...item, order: index + 1 }));
      } else {
        const mediaType: "photo" | "video" = asset.mediaType === "video" ? "video" : "photo";
        return [...prev, {
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename || `media_${asset.id}`,
          mediaType: mediaType,
          duration: asset.duration,
          order: prev.length + 1,
        }];
      }
    });
  }, []);

  const getSelectedOrder = useCallback((id: string): number | null => {
    const item = selectedMedia.find(m => m.id === id);
    return item ? item.order : null;
  }, [selectedMedia]);

  // const handleSendMedia = async () => {
  //   if (selectedMedia.length === 0 || isSending) return;
  //   setIsSending(true);
  //   try {
  //     const filesWithData = await Promise.all(
  //       selectedMedia.map(async (media) => {
  //         const base64 = await FileSystem.readAsStringAsync(media.uri, {
  //           encoding: FileSystem.EncodingType.Base64,
  //         });
  //         const mimeType = getMimeType(media.filename, media.mediaType);
  //         return {
  //           name: media.filename,
  //           mimeType: mimeType,
  //           fileData: base64,
  //         };
  //       })
  //     );

  //     const token = await AuthStorage.getToken();
  //     const uploadResponse = await axios.post(
  //       `${API_URL}/api/vm-media/upload`,
  //       { files: filesWithData },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );

  //     if (!uploadResponse.data.success) {
  //       throw new Error("Upload failed");
  //     }

  //     const tempFolderId = uploadResponse.data.tempFolderId;
  //     const uploadedFiles = uploadResponse.data.uploadedFiles;
  //     const filesWithCaptions = uploadedFiles.map((f: any) => ({
  //       fileName: f.fileName,
  //       originalName: f.originalName,
  //       caption: caption,
  //       mimeType: f.mimeType,
  //       size: f.size,
  //     }));

  //     const moveResponse = await axios.post(
  //       `${API_URL}/api/vm-media/move-to-chat`,
  //       {
  //         tempFolderId,
  //         roomId,
  //         senderId: userId,
  //         filesWithCaptions,
  //       },
  //       { headers: { Authorization: `Bearer ${token}` } }
  //     );

  //     if (moveResponse.data.success) {
  //       socketSendMessage(roomId, {
  //         id: moveResponse.data.messageId,
  //         messageText: moveResponse.data.message,
  //         createdAt: new Date().toISOString(),
  //         messageType: "media",
  //         mediaFilesId: moveResponse.data.mediaId,
  //         pollId: 0,
  //         tableId: 0,
  //         replyMessageId: 0,
  //       });
  //       // Navigate back to chat room
  //       router.back();
  //     }
  //   } catch (error) {
  //     console.error("Error sending media:", error);
  //     Alert.alert("Error", "Failed to send media. Please try again.");
  //   } finally {
  //     setIsSending(false);
  //   }
  // };

    // ... (keep your existing imports and helper functions)

// ... imports

  // ... existing state hooks

  // ------------------------------------------------------------------
  // 1. GALLERY UPLOAD FLOW (Multipart)
  // ------------------------------------------------------------------
  const handleSendMedia = async () => {
    if (selectedMedia.length === 0 || isSending) return;
    setIsSending(true);

    try {
      const token = await AuthStorage.getToken();
      const formData = new FormData();

      // 1. Append all selected files to FormData
      selectedMedia.forEach((media) => {
        // Clean URI for iOS
        const uri = Platform.OS === "ios" ? media.uri.replace("file://", "") : media.uri;
        const mimeType = getMimeType(media.filename, media.mediaType);

        // @ts-ignore
        formData.append("files", {
          uri: uri,
          name: media.filename,
          type: mimeType,
        });
      });

      console.log(`Uploading gallery files to: ${API_URL}/api/vm-media/upload-multipart`);

      // 2. Upload Files to Temp Folder (Multipart Stream)
      const uploadResponse = await axios.post(
        `${API_URL}/api/vm-media/upload-multipart`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          transformRequest: (data) => data, // Critical for React Native FormData
        }
      );

      if (!uploadResponse.data.success) {
        throw new Error("Gallery upload failed");
      }

      // 3. Move Files to Chat (Database & Permanent Folder)
      // This uses your EXISTING 'moveToChat' controller logic
      const tempFolderId = uploadResponse.data.tempFolderId;
      const uploadedFiles = uploadResponse.data.uploadedFiles;
      
      const filesWithCaptions = uploadedFiles.map((f: any) => ({
        fileName: f.fileName,
        originalName: f.originalName,
        caption: caption, // User typed caption
        mimeType: f.mimeType,
        size: f.size,
      }));

      const moveResponse = await axios.post(
        `${API_URL}/api/vm-media/move-to-chat`,
        {
          tempFolderId,
          roomId,
          senderId: userId,
          filesWithCaptions,
          caption: caption, // Send the caption to backend
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (moveResponse.data.success) {
        // 4. Notify Socket with the actual messageText (caption)
        socketSendMessage(roomId, {
          id: moveResponse.data.messageId,
          messageText: moveResponse.data.messageText || "", // Use the caption from backend
          createdAt: moveResponse.data.createdAt || new Date().toISOString(),
          messageType: "media",
          mediaFilesId: moveResponse.data.mediaId,
          pollId: 0,
          tableId: 0,
          replyMessageId: 0,
        });
        router.back();
      }
    } catch (error: any) {
      console.error("Error sending gallery media:", error);
      Alert.alert("Error", `Failed to send media: ${error?.message || "Check connection"}`);
    } finally {
      setIsSending(false);
    }
  };

  // ------------------------------------------------------------------
  // 2. CAMERA UPLOAD FLOW (Single Step Multipart)
  // ------------------------------------------------------------------
  const handleCameraSend = useCallback(async (uri: string, mediaType: 'photo' | 'video', duration?: number, caption?: string) => {
    if (isSending) return;
    setIsSending(true);
  
    try {
      const token = await AuthStorage.getToken();
      
      // 1. Prepare Filename
      const filename = uri.split('/').pop() || `camera_${Date.now()}.${mediaType === 'photo' ? 'jpg' : 'mp4'}`;
      const mimeType = getMimeType(filename, mediaType);
  
      // 2. Create FormData
      const formData = new FormData();
      
      // @ts-ignore
      formData.append("file", {
        uri: Platform.OS === "ios" ? uri.replace("file://", "") : uri,
        name: filename,
        type: mimeType,
      });
  
      // Append Metadata fields
      formData.append("roomId", roomId);
      formData.append("senderId", userId);
      if (caption) formData.append("caption", caption);
      if (duration) formData.append("duration", String(duration));
      
      console.log(`Sending camera file to: ${API_URL}/api/vm-media/move-to-chat-camera`);
      
      // 3. Single Step Upload & Move
      const response = await axios.post(
        `${API_URL}/api/vm-media/move-to-chat-camera`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          transformRequest: (data) => data, // Critical
          timeout: 120000, // 2 minutes timeout for large videos
        }
      );
  
      if (response.data.success) {
        // 4. Notify Socket with the actual messageText (caption)
        socketSendMessage(roomId, {
          id: response.data.messageId,
          messageText: response.data.messageText || "", // Use the caption from backend
          createdAt: response.data.createdAt || new Date().toISOString(),
          messageType: "media",
          mediaFilesId: response.data.mediaId,
          pollId: 0,
          tableId: 0,
          replyMessageId: 0,
        });
        
        setShowCamera(false);
        setTimeout(() => {
          router.back();
        }, 300);
      } else {
        throw new Error(response.data.error || "Upload failed");
      }
  
    } catch (error: any) {
      console.error("Error sending camera media:", error);
      Alert.alert("Error", `Upload failed: ${error?.response?.data?.error || error.message}`);
    } finally {
      setIsSending(false);
    }
  }, [roomId, userId, isSending, socketSendMessage]);


  const handleSuccess = useCallback(() => {
    // Navigate back to chat room
    router.back();
  }, []);

  const handleBackToGallery = useCallback(() => {
    setIndex(0); // Switch to gallery tab
  }, []);

  const handleCameraPress = useCallback(() => {
    setShowCamera(true);
  }, []);

  // const handleCameraSend = useCallback(async (uri: string, mediaType: 'photo' | 'video', duration?: number, caption?: string) => {
  //   if (isSending) return;
  //   setIsSending(true);
  //   try {
  //     // Read file as base64
  //     const base64 = await FileSystem.readAsStringAsync(uri, {
  //       encoding: FileSystem.EncodingType.Base64,
  //     });

  //     // Get filename from URI
  //     const filename = uri.split('/').pop() || `camera_${Date.now()}.${mediaType === 'photo' ? 'jpg' : 'mp4'}`;
  //     const mimeType = getMimeType(filename, mediaType);

  //     const filesWithData = [{
  //       name: filename,
  //       mimeType: mimeType,
  //       fileData: base64,
  //     }];

  //     const token = await AuthStorage.getToken();
  //     const uploadResponse = await axios.post(
  //       `${API_URL}/api/vm-media/upload`,
  //       { files: filesWithData },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );

  //     if (!uploadResponse.data.success) {
  //       throw new Error("Upload failed");
  //     }

  //     const tempFolderId = uploadResponse.data.tempFolderId;
  //     const uploadedFiles = uploadResponse.data.uploadedFiles;
  //     const filesWithCaptions = uploadedFiles.map((f: any) => ({
  //       fileName: f.fileName,
  //       originalName: f.originalName,
  //       caption: caption || "",
  //       mimeType: f.mimeType,
  //       size: f.size,
  //     }));

  //     const moveResponse = await axios.post(
  //       `${API_URL}/api/vm-media/move-to-chat`,
  //       {
  //         tempFolderId,
  //         roomId,
  //         senderId: userId,
  //         filesWithCaptions,
  //       },
  //       { headers: { Authorization: `Bearer ${token}` } }
  //     );

  //     if (moveResponse.data.success) {
  //       socketSendMessage(roomId, {
  //         id: moveResponse.data.messageId,
  //         messageText: moveResponse.data.message,
  //         createdAt: new Date().toISOString(),
  //         messageType: "media",
  //         mediaFilesId: moveResponse.data.mediaId,
  //         pollId: 0,
  //         tableId: 0,
  //         replyMessageId: 0,
  //       });
        
  //       // Close camera and go back
  //       setShowCamera(false);
  //       setTimeout(() => {
  //         router.back();
  //       }, 300);
  //     } else {
  //       throw new Error("Move to chat failed");
  //     }
  //   } catch (error) {
  //     console.error("Error sending camera media:", error);
  //     Alert.alert("Error", "Failed to send media");
  //   } finally {
  //     setIsSending(false);
  //   }
  // }, [roomId, userId, isSending, socketSendMessage]);

  // Prepare gallery data
  const galleryData: GalleryItem[] = useMemo(() => {
    const cameraItem: GalleryItem = { type: "camera" };
    const mediaItems: GalleryItem[] = mediaAssets.map(asset => ({ type: "media", asset }));
    return [cameraItem, ...mediaItems];
  }, [mediaAssets]);

  const renderGalleryItem = useCallback(({ item }: { item: GalleryItem }) => {
    if (item.type === "camera") {
      return <CameraItem onPress={handleCameraPress} />;
    }
    return (
      <MediaItem
        item={item.asset}
        selectedOrder={getSelectedOrder(item.asset.id)}
        onSelect={handleSelectMedia}
      />
    );
  }, [getSelectedOrder, handleSelectMedia, handleCameraPress]);

  const keyExtractor = useCallback((item: GalleryItem, index: number) => 
    item.type === "camera" ? "camera" : item.asset.id, []);

  // Show input bar only when in gallery tab with selected media
  const currentTabKey = routes[index].key;
  const showInputBar = currentTabKey === "gallery" && selectedMedia.length > 0;

  // Render scene for TabView
  const renderScene = useCallback(({ route }: { route: { key: string } }) => {
    switch (route.key) {
      case 'gallery':
        return (
          <FlatList
            data={galleryData}
            renderItem={renderGalleryItem}
            keyExtractor={keyExtractor}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.flatListContent}
            onEndReached={loadMoreMedia}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoading ? (
                <View style={styles.loadingFooter}>
                  <ActivityIndicator size="small" color="#2AABEE" />
                </View>
              ) : null
            }
          />
        );
      case 'poll':
        return (
          <PollContent
            roomId={roomId}
            userId={userId}
            onSuccess={handleSuccess}
            onBack={handleBackToGallery}
            showInSheet={false}
            isHalfScreen={false}
          />
        );
      case 'announcement':
        return (
          <AnnouncementContent
            roomId={roomId}
            userId={userId}
            onSuccess={handleSuccess}
            onBack={handleBackToGallery}
            showInSheet={false}
            isHalfScreen={false}
          />
        );
      default:
        return null;
    }
  }, [galleryData, renderGalleryItem, keyExtractor, loadMoreMedia, isLoading, roomId, userId, handleSuccess, handleBackToGallery]);

  // Custom TabBar
  const renderTabBar = useCallback((props: any) => (
    <TabBar
      {...props}
      indicatorStyle={styles.tabIndicator}
      style={styles.tabBar as any}
      tabStyle={styles.tab as any}
      labelStyle={styles.tabLabel}
      inactiveColor="#6b7280"
      activeColor="#3b82f6"
      scrollEnabled={true}
      bounces={true}
      pressColor="rgba(59, 130, 246, 0.1)"
      gap={8}
      renderLabel={({ route, focused, color }: { route: { key: string; title: string }; focused: boolean; color: string }) => {
        let icon;
        switch (route.key) {
          case 'gallery':
            icon = <GalleryIcon size={20} color={color} />;
            break;
          case 'poll':
            icon = <PollIcon size={20} color={color} />;
            break;
          case 'announcement':
            icon = <AnnouncementIcon size={20} color={color} />;
            break;
          default:
            icon = null;
        }
        return (
          <View style={styles.tabLabelContainer}>
            {icon}
            <Text style={[styles.tabLabelText, { color }]}>
              {route.title}
            </Text>
          </View>
        );
      }}
    />
  ), []);

  const getSelectionSummary = (): string => {
    const parts: string[] = [];
    if (selectedPhotosCount > 0) {
      parts.push(`${selectedPhotosCount} ${selectedPhotosCount === 1 ? 'photo' : 'photos'}`);
    }
    if (selectedVideosCount > 0) {
      parts.push(`${selectedVideosCount} ${selectedVideosCount === 1 ? 'video' : 'videos'}`);
    }
    return parts.join(', ') + ' selected';
  };

  const renderInputBar = () => (
    <View style={styles.inputBar}>
      <View style={styles.inputBarContent}>
        <TextInput
          style={styles.captionInput}
          placeholder="Add a caption..."
          placeholderTextColor="#999"
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          onPress={handleSendMedia}
          disabled={isSending || selectedMedia.length === 0}
          style={[styles.sendButton, (isSending || selectedMedia.length === 0) && styles.sendButtonDisabled]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.selectionInfoRow}>
        <Text style={styles.selectionCount}>
          {getSelectionSummary()}
        </Text>
        {selectedVideosCount > 0 && (
          <View style={styles.videoInfoBadge}>
            <Ionicons name="videocam" size={12} color="#fff" />
            <Text style={styles.videoInfoText}>{selectedVideosCount}</Text>
          </View>
        )}
        {selectedPhotosCount > 0 && (
          <View style={styles.photoInfoBadge}>
            <Ionicons name="image" size={12} color="#fff" />
            <Text style={styles.photoInfoText}>{selectedPhotosCount}</Text>
          </View>
        )}
      </View>
    </View>
  );

  // Show camera screen if active
  if (showCamera) {
    return (
      <CameraScreen
        roomId={roomId}
        userId={userId}
        onSend={handleCameraSend}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Tab View */}
        <View style={styles.tabViewContainer}>
          <TabView
            navigationState={{ index, routes }}
            renderScene={renderScene}
            onIndexChange={setIndex}
            initialLayout={{ width: layout.width }}
            renderTabBar={renderTabBar}
            lazy={true}
            lazyPreloadDistance={0}
            swipeEnabled={true}
          />
        </View>

        {/* Input Bar - Only shown for gallery with selected media */}
        {showInputBar && (
          <View style={styles.inputBarContainer}>
            {renderInputBar()}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  headerSpacer: {
    width: 100,
  },
  contentContainer: {
    flex: 1,
  },
  tabViewContainer: {
    flex: 1,
  },
  tabIndicator: {
    backgroundColor: '#3b82f6',
    height: 3,
    borderRadius: 1.5,
  },
  tabBar: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    width: 'auto',
    paddingHorizontal: 16,
  },
  tabLabel: {
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'none',
  },
  tabLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabelText: {
    fontWeight: '600',
    fontSize: 13,
  },
  inputBarContainer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  inputBar: {
    padding: 16,
  },
  inputBarContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  captionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2AABEE",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  selectionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  selectionCount: {
    color: "#666",
    fontSize: 12,
    flex: 1,
  },
  videoInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
  },
  videoInfoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  photoInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2AABEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
  },
  photoInfoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  flatListContent: {
    paddingHorizontal: ITEM_MARGIN,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: ITEM_MARGIN / 2,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  mediaImage: {
    flex: 1,
    borderRadius: 4,
  },
  cameraContainer: {
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraText: {
    marginTop: 8,
    fontSize: 12,
    color: "#666",
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  durationText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  selectionBubble: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  selectionBubbleSelected: {
    backgroundColor: "#2AABEE",
  },
  selectionNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
