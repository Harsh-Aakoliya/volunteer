import React, { useState, useEffect, useRef } from "react";
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
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from "expo-video";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import axios from "axios";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  initialIndex = 0 
}: MediaViewerModalProps) {
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const flatListRef = useRef<FlatList>(null);

  // Fetch media data when modal opens
  useEffect(() => {
    if (visible) {
      if (mediaFiles && mediaFiles.length > 0) {
        // Use provided media files directly
        setMediaData({
          id: 0,
          roomId: 0,
          senderId: '',
          createdAt: '',
          messageId: 0,
          files: mediaFiles.map(file => ({
            url: file.fileName || file.id,
            filename: file.fileName,
            originalName: file.originalName || file.fileName,
            caption: '',
            mimeType: file.mimeType,
            size: file.size || 0
          }))
        });
        setLoading(false);
        setError(null);
        setCurrentIndex(initialIndex);
      } else if (mediaId) {
        // Fetch media data from API
        fetchMediaData();
      }
    } else {
      // Reset when modal closes
      setCurrentIndex(0);
    }
  }, [visible, mediaId, mediaFiles, initialIndex]);

  // Scroll to initial index when data is loaded
  useEffect(() => {
    if (visible && mediaData && mediaData.files.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: initialIndex, 
          animated: false 
        });
      }, 100);
    }
  }, [visible, mediaData]);

  const fetchMediaData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AuthStorage.getToken();
      console.log(`Fetching media data for ID: ${mediaId}`);
      
      const response = await axios.get(
        `${API_URL}/api/vm-media/media/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setMediaData(response.data.media);
        setCurrentIndex(initialIndex);
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
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  // Render full-screen media item for carousel
  const renderCarouselItem = ({ item, index }: { item: MediaFile; index: number }) => {
    const isImage = item.mimeType.startsWith('image/');
    const isVideo = item.mimeType.startsWith('video/');
    const isAudio = item.mimeType.startsWith('audio/');

    return (
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 150 }}>
        {isImage && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Image
              source={{ uri: `${API_URL}/media/chat/${item.url}` }}
              style={{ 
                width: SCREEN_WIDTH,
                height: '100%',
              }}
              resizeMode="contain"
            />
          </View>
        )}
        
        {isVideo && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
            <FullScreenVideoPlayer file={item} />
          </View>
        )}
        
        {isAudio && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ 
              width: 200, 
              height: 200, 
              backgroundColor: '#8b5cf6', 
              borderRadius: 100,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <Ionicons name="musical-notes" size={80} color="white" />
            </View>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600', 
              color: '#1f2937',
              textAlign: 'center',
              marginTop: 20 
            }}>
              {item.originalName}
            </Text>
            <Text style={{ 
              fontSize: 14, 
              color: '#6b7280',
              marginTop: 8 
            }}>
              Audio File
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Render pagination dots
  const renderDots = () => {
    if (!mediaData || mediaData.files.length <= 1) return null;

    return (
      <View style={styles.dotsContainer}>
        {mediaData.files.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex ? '#3b82f6' : '#d1d5db',
                width: index === currentIndex ? 10 : 8,
                height: index === currentIndex ? 10 : 8,
              }
            ]}
          />
        ))}
      </View>
    );
  };



  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          
          {mediaData && (
            <Text style={styles.headerTitle}>
              {currentIndex + 1} / {mediaData.files.length}
            </Text>
          )}
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
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={fetchMediaData}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : mediaData && mediaData.files.length > 0 ? (
          <>
            {/* Carousel */}
            <FlatList
              ref={flatListRef}
              data={mediaData.files}
              renderItem={renderCarouselItem}
              keyExtractor={(item, index) => `${item.url}-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              initialScrollIndex={initialIndex}
              getItemLayout={(data, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              onScrollToIndexFailed={(info) => {
                const wait = new Promise(resolve => setTimeout(resolve, 500));
                wait.then(() => {
                  flatListRef.current?.scrollToIndex({ 
                    index: info.index, 
                    animated: false 
                  });
                });
              }}
            />

            {/* Pagination Dots */}
            {renderDots()}

            {/* File Info
            {mediaData.files[currentIndex] && (
              <View style={styles.fileInfoContainer}>
                <Text style={styles.fileName}>
                  {mediaData.files[currentIndex].originalName}
                </Text>
              </View>
            )} */}
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

// Full-screen video player component
interface FullScreenVideoPlayerProps {
  file: MediaFile;
}

const FullScreenVideoPlayer: React.FC<FullScreenVideoPlayerProps> = ({ file }) => {
  const videoUrl = `${API_URL}/media/chat/${file.url}`;
  
  const videoPlayer = useVideoPlayer(videoUrl, player => {
    if (player) {
      player.loop = false;
      player.muted = false;
    }
  });

  return (
    <VideoView
      style={{ 
        width: SCREEN_WIDTH,
        height: '100%',
      }}
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
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: -1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    borderRadius: 5,
  },
  fileInfoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
  },
  fileName: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
}); 