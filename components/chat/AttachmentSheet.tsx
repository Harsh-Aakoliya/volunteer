// components/chat/AttachmentSheet.tsx
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
  Keyboard
} from "react-native";
import BottomSheet, { 
  BottomSheetFlatList, 
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";
import { router } from "expo-router";
import PollContent from "./PollContent";
import AnnouncementContent from "./AnnouncementContent";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// Bottom section heights
const TAB_BAR_HEIGHT = 110;
const INPUT_BAR_HEIGHT = 100;

// ---------- TYPES ----------
interface SelectedMedia {
  id: string;
  uri: string;
  filename: string;
  mediaType: "photo" | "video";
  duration?: number;
  order: number;
}

interface AttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  onMediaSent?: () => void;
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

// Helper to get mime type based on file extension and media type
const getMimeType = (filename: string, mediaType: "photo" | "video"): string => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  if (mediaType === "video") {
    switch (extension) {
      case "mp4":
        return "video/mp4";
      case "mov":
        return "video/quicktime";
      case "avi":
        return "video/x-msvideo";
      case "mkv":
        return "video/x-matroska";
      case "webm":
        return "video/webm";
      case "3gp":
        return "video/3gpp";
      default:
        return "video/mp4";
    }
  } else {
    switch (extension) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      case "heic":
        return "image/heic";
      case "heif":
        return "image/heif";
      default:
        return "image/jpeg";
    }
  }
};

// ---------- CAMERA ITEM COMPONENT ----------
const CameraItem = React.memo(({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    style={styles.mediaItem}
  >
    <View style={styles.cameraContainer}>
      <View style={styles.cameraIconCircle}>
        <Ionicons name="camera" size={28} color="white" />
      </View>
    </View>
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
  onSelect: (item: MediaLibrary.Asset) => void;
}) => {
  const isSelected = selectedOrder !== null;
  const isVideo = item.mediaType === "video";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onSelect(item)}
      style={styles.mediaItem}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.mediaImage}
        resizeMode="cover"
      />
      
      {/* Video indicator overlay */}
      {isVideo && (
        <View style={styles.videoOverlay}>
          <View style={styles.videoPlayIconContainer}>
            <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      )}
      
      {/* Duration badge for videos */}
      {isVideo && (
        <View style={styles.durationBadge}>
          <Ionicons name="videocam" size={12} color="white" />
          <Text style={styles.durationText}>
            {formatDuration(item.duration || 0)}
          </Text>
        </View>
      )}

      {/* Selection bubble */}
      <View style={[styles.selectionBubble, isSelected && styles.selectionBubbleSelected]}>
        {isSelected && (
          <Text style={styles.selectionNumber}>{selectedOrder}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ---------- MAIN COMPONENT ----------
export default function AttachmentSheet({
  isOpen,
  onClose,
  roomId,
  userId,
  onMediaSent,
}: AttachmentSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { sendMessage: socketSendMessage } = useSocket();

  // Animated shared value - BottomSheet will update this
  const animatedIndex = useSharedValue(0);

  // State
  const [activeTab, setActiveTab] = useState<TabType>("gallery");
  const [mediaAssets, setMediaAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Snap points - half screen and full screen
  const snapPoints = useMemo(() => ["100%", "90%"], []);

  // Determine what bottom section to show
  const showTabBar = activeTab === "gallery" ? selectedMedia.length === 0 : true;
  const showInputBar = activeTab === "gallery" && selectedMedia.length > 0;

  // Count selected photos and videos
  const selectedPhotosCount = useMemo(() => 
    selectedMedia.filter(m => m.mediaType === "photo").length, [selectedMedia]);
  const selectedVideosCount = useMemo(() => 
    selectedMedia.filter(m => m.mediaType === "video").length, [selectedMedia]);

  // ============ ANIMATED STYLES ============
  
  const animatedTabBarStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      animatedIndex.value,
      [-0.5, 0, 0.5],
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    
    const translateY = interpolate(
      animatedIndex.value,
      [-0.5, 0, 0.5],
      [TAB_BAR_HEIGHT, 0, TAB_BAR_HEIGHT],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const animatedInputBarStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      animatedIndex.value,
      [-0.5, 0, 1],
      [0, 1, 1],
      Extrapolation.CLAMP
    );
    
    const translateY = interpolate(
      animatedIndex.value,
      [-0.5, 0, 1],
      [INPUT_BAR_HEIGHT, 0, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const handleSheetChanges = useCallback((index: number) => {
    setCurrentIndex(index);
    if (index === -1) {
      Keyboard.dismiss();
      
      setTimeout(() => {
        setActiveTab("gallery");
        setSelectedMedia([]);
        setCaption("");
        onClose();
      }, 50);
    }
  }, [onClose]);

  // Request permission and load media only when opened
  useEffect(() => {
    if (isOpen && hasPermission === null) {
      requestPermissionAndLoadMedia();
    }
  }, [isOpen, hasPermission]);

  // Control sheet visibility
  useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.snapToIndex(0);
      animatedIndex.value = 0;
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isOpen]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab("gallery");
      setCurrentIndex(0);
    }
  }, [isOpen]);

  // Auto-expand to full screen when keyboard appears in poll/announcement
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        if ((activeTab === 'poll' || activeTab === 'announcement') && currentIndex === 0) {
          bottomSheetRef.current?.snapToIndex(1);
        }
      }
    );

    return () => {
      keyboardShowListener.remove();
    };
  }, [activeTab, currentIndex]);

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

  const loadMedia = async (cursor?: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: 30,
        after: cursor,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      // Log to debug - you can remove this later
      console.log(`Loaded ${result.assets.length} assets`);
      result.assets.forEach(asset => {
        if (asset.mediaType === "video") {
          console.log(`Video: ${asset.filename}, Duration: ${asset.duration}s`);
        }
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
        // Deselect - remove and reorder remaining
        const newSelection = prev.filter(m => m.id !== asset.id);
        return newSelection.map((item, index) => ({ ...item, order: index + 1 }));
      } else {
        // Select - add to selection
        const mediaType: "photo" | "video" = asset.mediaType === "video" ? "video" : "photo";
        return [...prev, {
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
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

  const handleClearSelection = useCallback(() => {
    setSelectedMedia([]);
    setCaption("");
  }, []);

  const handleSendMedia = async () => {
    if (selectedMedia.length === 0 || isSending) return;

    setIsSending(true);
    try {
      const filesWithData = await Promise.all(
        selectedMedia.map(async (media) => {
          const base64 = await FileSystem.readAsStringAsync(media.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const mimeType = getMimeType(media.filename, media.mediaType);
          
          return {
            name: media.filename,
            mimeType: mimeType,
            fileData: base64,
          };
        })
      );

      const token = await AuthStorage.getToken();
      const uploadResponse = await axios.post(
        `${API_URL}/api/vm-media/upload`,
        { files: filesWithData },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!uploadResponse.data.success) {
        throw new Error("Upload failed");
      }

      const tempFolderId = uploadResponse.data.tempFolderId;
      const uploadedFiles = uploadResponse.data.uploadedFiles;

      const filesWithCaptions = uploadedFiles.map((f: any) => ({
        fileName: f.fileName,
        originalName: f.originalName,
        caption: caption,
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
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (moveResponse.data.success) {
        socketSendMessage(roomId, {
          id: moveResponse.data.messageId,
          messageText: moveResponse.data.message,
          createdAt: new Date().toISOString(),
          messageType: "media",
          mediaFilesId: moveResponse.data.mediaId,
          pollId: 0,
          tableId: 0,
          replyMessageId: 0,
        });

        setSelectedMedia([]);
        setCaption("");
        
        Keyboard.dismiss();
        
        setTimeout(() => {
          onClose();
          onMediaSent?.();
        }, 100);
      }
    } catch (error) {
      console.error("Error sending media:", error);
      Alert.alert("Error", "Failed to send media. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleTabPress = useCallback((tab: TabType) => {
    setActiveTab(tab);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const handleSuccess = useCallback(() => {
    Keyboard.dismiss();
    
    setTimeout(() => {
      setActiveTab("gallery");
      setSelectedMedia([]);
      setCaption("");
      onClose();
      onMediaSent?.();
    }, 200);
  }, [onClose, onMediaSent]);

  const handleBackToGallery = useCallback(() => {
    Keyboard.dismiss();
    setTimeout(() => {
      setActiveTab("gallery");
      bottomSheetRef.current?.snapToIndex(0);
    }, 100);
  }, []);

  const handleCameraPress = useCallback(() => {
    onClose();
    router.push({ pathname: "/chat/MediaUploader", params: { roomId, userId, vmMedia: "true" } });
  }, [onClose, roomId, userId]);

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

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const ListFooter = useCallback(() => (
    isLoading ? (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#2AABEE" />
      </View>
    ) : null
  ), [isLoading]);

  // Get selection summary text
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

  if (!isOpen) return null;

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "poll":
        return (
          <View style={styles.tabContentContainer}>
            <PollContent
              roomId={roomId}
              userId={userId}
              onSuccess={handleSuccess}
              onBack={handleBackToGallery}
              showInSheet={true}
              isHalfScreen={currentIndex === 0}
            />
          </View>
        );
      case "announcement":
        return (
          <View style={styles.tabContentContainer}>
            {Platform.OS !== "web" ? 
            <AnnouncementContent
              roomId={roomId}
              userId={userId}
              onSuccess={handleSuccess}
              onBack={handleBackToGallery}
              showInSheet={true}
              isHalfScreen={currentIndex === 0}
            /> : <></>}
          </View>
        );
      default:
        return (
          <>
            {hasPermission === false ? (
              <View style={styles.permissionContainer}>
                <Ionicons name="images-outline" size={48} color="#ccc" />
                <Text style={styles.permissionText}>
                  Please grant photo library access to select media
                </Text>
                <TouchableOpacity
                  onPress={requestPermissionAndLoadMedia}
                  style={styles.permissionButton}
                >
                  <Text style={styles.permissionButtonText}>Grant Access</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <BottomSheetFlatList
                data={galleryData}
                renderItem={renderGalleryItem}
                keyExtractor={keyExtractor}
                numColumns={NUM_COLUMNS}
                onEndReached={loadMoreMedia}
                onEndReachedThreshold={0.3}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={ListFooter}
                initialNumToRender={12}
                maxToRenderPerBatch={15}
                windowSize={5}
                removeClippedSubviews={Platform.OS === "android"}
                contentContainerStyle={[
                  styles.flatListContent,
                  { paddingBottom: showInputBar ? INPUT_BAR_HEIGHT + 20 : TAB_BAR_HEIGHT + 20 }
                ]}
              />
            )}
          </>
        );
    }
  };

  // Tab Bar Component
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity onPress={() => handleTabPress("gallery")} style={styles.tabItem}>
        <View style={[styles.tabIcon, activeTab === "gallery" ? styles.tabIconGalleryActive : styles.tabIconGallery]}>
          <GalleryIcon size={22} color="#fff" />
        </View>
        <Text style={[styles.tabLabel, activeTab === "gallery" && styles.tabLabelActive]}>Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => handleTabPress("poll")} style={styles.tabItem}>
        <View style={[styles.tabIcon, activeTab === "poll" ? styles.tabIconPollActive : styles.tabIconPoll]}>
          <PollIcon size={22} color="#fff" />
        </View>
        <Text style={[styles.tabLabel, activeTab === "poll" && styles.tabLabelActive]}>Poll</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => handleTabPress("announcement")} style={styles.tabItem}>
        <View style={[styles.tabIcon, activeTab === "announcement" ? styles.tabIconAnnounceActive : styles.tabIconAnnounce]}>
          <AnnouncementIcon size={22} color="#fff" />
        </View>
        <Text style={[styles.tabLabel, activeTab === "announcement" && styles.tabLabelActive]}>Announcement</Text>
      </TouchableOpacity>
    </View>
  );

  // Input Bar Component
  const renderInputBar = () => (
    <View style={styles.inputBarInner}>
      <View style={styles.captionRow}>
        <TouchableOpacity onPress={handleClearSelection} style={styles.clearButton}>
          <Ionicons name="close-circle" size={24} color="#8E8E93" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.captionInput}
          placeholder="Add a caption..."
          placeholderTextColor="#8E8E93"
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={500}
        />
        
        <TouchableOpacity
          onPress={handleSendMedia}
          disabled={isSending}
          style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
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

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBackground}
        style={styles.sheet}
        animatedIndex={animatedIndex}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        enableContentPanningGesture={true}
        enableHandlePanningGesture={true}
      >
        <View style={styles.container}>
          {/* Main Content Area */}
          <View style={styles.contentContainer}>
            {renderContent()}
          </View>
        </View>
      </BottomSheet>

      {/* Floating Tab Bar - Fades when going to full screen OR when closing */}
      {isOpen && showTabBar && (
        <Animated.View 
          style={[
            styles.floatingBottomBar,
            animatedTabBarStyle,
          ]}
          pointerEvents="box-none"
        >
          {renderTabBar()}
        </Animated.View>
      )}

      {/* Floating Input Bar - STAYS visible in full screen, only fades when closing */}
      {isOpen && showInputBar && (
        <Animated.View 
          style={[
            styles.floatingBottomBar,
            animatedInputBarStyle,
          ]}
          pointerEvents="box-none"
        >
          {renderInputBar()}
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  sheetBackground: {
    backgroundColor: "#fff",
  },
  handleIndicator: {
    backgroundColor: "#DADADA",
    width: 36,
    height: 4,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  tabContentContainer: {
    flex: 1,
  },
  flatListContent: {
    paddingHorizontal: ITEM_MARGIN,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: ITEM_MARGIN / 2,
  },
  mediaImage: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: '#1a1a1a', // Placeholder background while loading
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Video overlay styles
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
  
  // Duration badge styles - improved visibility
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
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionBubbleSelected: {
    backgroundColor: "#2AABEE",
    borderColor: "#2AABEE",
  },
  selectionNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  loadingFooter: {
    paddingVertical: 16,
    alignItems: "center",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  permissionText: {
    color: "#666",
    textAlign: "center",
    marginTop: 16,
    fontSize: 14,
  },
  permissionButton: {
    marginTop: 16,
    backgroundColor: "#2AABEE",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  
  // ========== FLOATING BOTTOM BAR ==========
  floatingBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  
  // ========== TAB BAR STYLES ==========
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    backgroundColor: "#fff",
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 15,
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
  },
  tabIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconGallery: {
    backgroundColor: "#54A9EB",
  },
  tabIconGalleryActive: {
    backgroundColor: "#2AABEE",
  },
  tabIconPoll: {
    backgroundColor: "#F5C563",
  },
  tabIconPollActive: {
    backgroundColor: "#F39C12",
  },
  tabIconAnnounce: {
    backgroundColor: "#EC7063",
  },
  tabIconAnnounceActive: {
    backgroundColor: "#E74C3C",
  },
  tabLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  tabLabelActive: {
    color: "#333",
    fontWeight: "600",
  },

  // ========== INPUT BAR STYLES ==========
  inputBarInner: {
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 15,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  captionInput: {
    flex: 1,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 80,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2AABEE",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  selectionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 36,
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
});