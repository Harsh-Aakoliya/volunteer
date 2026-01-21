//components/chat/MediaViewerModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import axios from "axios";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface MediaFile {
  url: string;
  filename: string;
  originalName: string;
  caption: string;
  mimeType: string;
  size: number;
}

interface MediaData {
  id: number;
  roomId: number;
  senderId: string;
  createdAt: string;
  messageId: number;
  files: MediaFile[];
}

interface MediaViewerModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId?: number | null;
  mediaFiles?: any[];
  initialIndex?: number;
}

export default function MediaViewerModal({
  visible,
  onClose,
  mediaId,
  mediaFiles,
  initialIndex = 0,
}: MediaViewerModalProps) {
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Reset state when modal visibility changes
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setIsLayoutReady(false);

      if (mediaFiles && mediaFiles.length > 0) {
        // Use provided media files directly
        const formattedFiles = mediaFiles.map((file) => ({
          url: file.fileName || file.id,
          filename: file.fileName,
          originalName: file.originalName || file.fileName,
          caption: "",
          mimeType: file.mimeType,
          size: file.size || 0,
        }));

        setMediaData({
          id: 0,
          roomId: 0,
          senderId: "",
          createdAt: "",
          messageId: 0,
          files: formattedFiles,
        });
        setLoading(false);
        setError(null);
      } else if (mediaId) {
        // Fetch media data from API
        fetchMediaData();
      }
    } else {
      // Reset when modal closes
      setMediaData(null);
      setCurrentIndex(0);
      setIsLayoutReady(false);
    }
  }, [visible, mediaId, mediaFiles, initialIndex]);

  // Scroll to initial index after layout is ready
  useEffect(() => {
    if (
      visible &&
      isLayoutReady &&
      mediaData &&
      mediaData.files.length > 0 &&
      initialIndex > 0
    ) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible, isLayoutReady, mediaData, initialIndex]);

  const fetchMediaData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AuthStorage.getToken();
      console.log(`Fetching media data for ID: ${mediaId}`);

      const response = await axios.get(
        `${API_URL}/api/vm-media/media/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setMediaData(response.data.media);
        console.log(`Loaded ${response.data.media.files.length} files`);
      } else {
        setError("Failed to load media files");
      }
    } catch (error: any) {
      console.error("Error fetching media:", error);
      setError(error.response?.data?.error || "Failed to load media files");
    } finally {
      setLoading(false);
    }
  };

  // Handle scroll end to update current index
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleLayout = useCallback(() => {
    setIsLayoutReady(true);
  }, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
      const wait = new Promise((resolve) => setTimeout(resolve, 500));
      wait.then(() => {
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: false,
        });
      });
    },
    []
  );

  // Render full-screen media item for carousel
  const renderCarouselItem = useCallback(
    ({ item, index }: { item: MediaFile; index: number }) => {
      const isImage = item.mimeType?.startsWith("image/");
      const isVideo = item.mimeType?.startsWith("video/");
      const isAudio = item.mimeType?.startsWith("audio/");

      const imageUrl = `${API_URL}/media/chat/${item.url}`;

      return (
        <View style={styles.carouselItem}>
          {isImage && (
            <View style={styles.mediaContainer}>
              <Image
                source={{
                  uri: imageUrl,
                  width: SCREEN_WIDTH,
                  height: SCREEN_HEIGHT,
                }}
                style={styles.fullImage}
                resizeMode="contain"
                resizeMethod="resize"
                onError={(e) => {

                  console.log(`Image load error for index ${index}: file to fetch is ${imageUrl}`, e.nativeEvent.error);
                }}
              />
            </View>
          )}

          {isVideo && (
            <View style={styles.videoContainer}>
              <VideoPlayer file={item} isActive={index === currentIndex} />
            </View>
          )}

          {isAudio && (
            <View style={styles.audioContainer}>
              <View style={styles.audioIcon}>
                <Ionicons name="musical-notes" size={80} color="white" />
              </View>
              <Text style={styles.audioFileName}>{item.originalName}</Text>
              <Text style={styles.audioLabel}>Audio File</Text>
            </View>
          )}

          {!isImage && !isVideo && !isAudio && (
            <View style={styles.unknownContainer}>
              <Ionicons name="document-outline" size={60} color="#9ca3af" />
              <Text style={styles.unknownFileName}>{item.originalName}</Text>
              <Text style={styles.unknownLabel}>
                Unsupported file type: {item.mimeType}
              </Text>
            </View>
          )}
        </View>
      );
    },
    [currentIndex]
  );

  // Render pagination dots
  const renderDots = () => {
    if (!mediaData || mediaData.files.length <= 1) return null;

    // If too many files, show condensed version
    if (mediaData.files.length > 10) {
      return (
        <View style={styles.dotsContainer}>
          <Text style={styles.paginationText}>
            {currentIndex + 1} of {mediaData.files.length}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.dotsContainer}>
        {mediaData.files.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex ? "#3b82f6" : "#6b7280",
                width: index === currentIndex ? 10 : 8,
                height: index === currentIndex ? 10 : 8,
                opacity: index === currentIndex ? 1 : 0.6,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const keyExtractor = useCallback(
    (item: MediaFile, index: number) => `media-${index}-${item.url}`,
    []
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            {mediaData && mediaData.files.length > 0 && (
              <Text style={styles.headerTitle}>
                {currentIndex + 1} / {mediaData.files.length}
              </Text>
            )}
          </View>

          {/* Placeholder for right side to center title */}
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading media files...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchMediaData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : mediaData && mediaData.files.length > 0 ? (
          <View style={styles.carouselContainer} onLayout={handleLayout}>
            {/* Carousel */}
            <FlatList
              ref={flatListRef}
              data={mediaData.files}
              renderItem={renderCarouselItem}
              keyExtractor={keyExtractor}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={getItemLayout}
              onScrollToIndexFailed={handleScrollToIndexFailed}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews={true}
              bounces={false}
              decelerationRate="fast"
              snapToInterval={SCREEN_WIDTH}
              snapToAlignment="start"
            />

            {/* Pagination Dots */}
            {renderDots()}

            {/* File name at bottom */}
            {mediaData.files[currentIndex] && (
              <View style={styles.fileInfoContainer}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {mediaData.files[currentIndex].originalName}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={60} color="#6b7280" />
            <Text style={styles.emptyText}>No media files available</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// Video player component - only plays when active
interface VideoPlayerProps {
  file: MediaFile;
  isActive: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ file, isActive }) => {
  const videoUrl = `${API_URL}/media/chat/${file.url}`;

  const videoPlayer = useVideoPlayer(videoUrl, (player) => {
    if (player) {
      player.loop = false;
      player.muted = false;
    }
  });

  // Pause video when not active
  useEffect(() => {
    if (videoPlayer) {
      if (!isActive) {
        videoPlayer.pause();
      }
    }
  }, [isActive, videoPlayer]);

  return (
    <VideoView
      style={styles.videoPlayer}
      player={videoPlayer}
      nativeControls={true}
      allowsFullscreen={true}
      allowsPictureInPicture={true}
      contentFit="contain"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  closeButton: {
    padding: 8,
    width: 44,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  headerPlaceholder: {
    width: 44,
  },
  carouselContainer: {
    flex: 1,
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 180,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  videoContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  audioContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  audioIcon: {
    width: 200,
    height: 200,
    backgroundColor: "#8b5cf6",
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  audioFileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
  },
  audioLabel: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
  },
  unknownContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  unknownFileName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
    textAlign: "center",
    marginTop: 16,
  },
  unknownLabel: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#9ca3af",
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    marginTop: 16,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    borderRadius: 5,
  },
  paginationText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  fileInfoContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
    borderRadius: 8,
  },
  fileName: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
});