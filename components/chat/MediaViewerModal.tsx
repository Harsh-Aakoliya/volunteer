// components/chat/MediaViewerModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  FlatList,
  StatusBar,
  Platform,
  BackHandler,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { API_URL } from "@/constants/api";
import { getMediaFiles } from "@/api/chat/media";
import { Video, ResizeMode } from "expo-av";
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

// ─── Video Thumbnail Cell (Same as MediaGrid) ───────────────────────────────
const VideoThumbnail: React.FC<{
  file: MediaFile;
  width: number;
  height: number;
}> = ({ file, width, height }) => {
  const uri = `${API_URL}/media/chat/${file.filename}`;

  return (
    <View style={{ width, height }}>
      <Video
        source={{ uri }}
        style={{ width, height }}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isMuted
        isLooping={false}
        useNativeControls={false}
      />

      {/* Play overlay */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.8)",
          }}
        >
          <Ionicons name="play" size={26} color="white" style={{ marginLeft: 3 }} />
        </View>
      </View>

      {/* Video label */}
      <View
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.7)",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 12,
        }}
      >
      </View>
    </View>
  );
};
// ─── Video Player ────────────────────────────────────────────────────────────
interface VideoPlayerCompProps {
  file: MediaFile;
  isActive: boolean;
}

const VideoPlayerComp: React.FC<VideoPlayerCompProps> = ({ file, isActive }) => {
  const videoUrl = `${API_URL}/media/chat/${file.url}`;

  const videoPlayer = useVideoPlayer(videoUrl, (player) => {
    if (player) {
      player.loop = false;
      player.muted = false;
    }
  });

  useEffect(() => {
    if (videoPlayer && !isActive) {
      videoPlayer.pause();
    }
  }, [isActive, videoPlayer]);

  return (
    <VideoView
      style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 120 }}
      player={videoPlayer}
      nativeControls={true}
      allowsFullscreen={true}
      allowsPictureInPicture={true}
      contentFit="contain"
    />
  );
};

// ─── Gallery Item ────────────────────────────────────────────────────────────
interface GalleryItemProps {
  item: MediaFile;
  index: number;
  onPress: (index: number) => void;
}

const GalleryItem: React.FC<GalleryItemProps> = React.memo(
  ({ item, index, onPress }) => {
    const isImage = item.mimeType?.startsWith("image/");
    const isVideo = item.mimeType?.startsWith("video/");
    const isAudio = item.mimeType?.startsWith("audio/");
    const mediaUrl = `${API_URL}/media/chat/${item.url}`;

    const [imageHeight, setImageHeight] = useState<number | null>(null);

    useEffect(() => {
      if (isImage) {
        Image.getSize(
          mediaUrl,
          (w, h) => {
            const aspectRatio = h / w;
            const calculated = SCREEN_WIDTH * aspectRatio;
            setImageHeight(
              Math.min(Math.max(calculated, 100), SCREEN_HEIGHT * 0.85)
            );
          },
          () => setImageHeight(SCREEN_WIDTH * 0.6)
        );
      }
    }, [mediaUrl, isImage]);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(index)}
        style={{ width: SCREEN_WIDTH }}
        className="bg-neutral-950"
      >
        {isImage && (
          <View>
            {imageHeight === null ? (
              <View
                className="w-full justify-center items-center bg-neutral-900"
                style={{ height: 200 }}
              >
                <ActivityIndicator size="small" color="#555" />
              </View>
            ) : (
              <Image
                source={{ uri: mediaUrl }}
                style={{ width: SCREEN_WIDTH, height: imageHeight }}
                resizeMode="contain"
                className="bg-neutral-950"
              />
            )}
          </View>
        )}

        {isVideo && (
          <VideoThumbnail
            file={item}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT * 0.8}
          />
        )}

        {isAudio && (
          <View
            className="w-full bg-neutral-800 flex-row items-center px-5"
            style={{ height: 76 }}
          >
            <View className="bg-purple-600 rounded-full w-12 h-12 justify-center items-center mr-4">
              <Ionicons name="musical-notes" size={22} color="white" />
            </View>
            <View className="flex-1 mr-3">
              <Text className="text-white text-sm font-medium" numberOfLines={1}>
                {item.originalName}
              </Text>
              <Text className="text-gray-500 text-xs mt-0.5">Audio</Text>
            </View>
            <Ionicons name="play-circle" size={34} color="#a78bfa" />
          </View>
        )}

        {!isImage && !isVideo && !isAudio && (
          <View
            className="w-full bg-neutral-800 flex-row items-center px-5"
            style={{ height: 76 }}
          >
            <View className="bg-gray-600 rounded-lg w-12 h-12 justify-center items-center mr-4">
              <Ionicons name="document-outline" size={22} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-300 text-sm font-medium" numberOfLines={1}>
                {item.originalName}
              </Text>
              <Text className="text-gray-600 text-xs mt-0.5">{item.mimeType}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }
);

// ─── Gallery View ────────────────────────────────────────────────────────────
interface GalleryViewProps {
  files: MediaFile[];
  onClose: () => void;
  onMediaPress: (index: number) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({
  files,
  onClose,
  onMediaPress,
  loading,
  error,
  onRetry,
}) => {
  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-white border-b border-neutral-200">
  
  <TouchableOpacity onPress={onClose}>
    <Ionicons name="close" size={28} color="black" />
  </TouchableOpacity>

  <Text className="text-black text-lg font-semibold">
    Media{files.length > 0 ? `: ${files.length} file${files.length !== 1 ? "s" : ""}` : ""}
  </Text>

  <View style={{ width: 28 }} />

</View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-500 mt-4">Loading media...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="alert-circle-outline" size={56} color="#ef4444" />
          <Text className="text-red-400 text-center mt-4 text-base">{error}</Text>
          <TouchableOpacity
            className="bg-blue-500 px-8 py-3 rounded-xl mt-6"
            onPress={onRetry}
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : files.length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {files.map((item, index) => (
            <>
            <View key={`gal-${index}-${item.url}`} className="flex-1">
              <GalleryItem item={item} index={index} onPress={onMediaPress} />
              {index < files.length - 1 && (
                <View className="h-0.5 bg-neutral-900" />
              )}
            </View>
            <View className="h-1.5 bg-neutral-900" />
            </>
          ))}
        </ScrollView>
      ) : (
        <View className="flex-1 justify-center items-center">
          <Ionicons name="images-outline" size={56} color="#555" />
          <Text className="text-gray-600 text-base mt-4">No media files</Text>
        </View>
      )}
    </View>
  );
};

// ─── Fullscreen Horizontal Viewer ────────────────────────────────────────────
interface FullScreenViewerProps {
  files: MediaFile[];
  initialIndex: number;
  onBack: () => void;
}

const FullScreenViewer: React.FC<FullScreenViewerProps> = ({
  files,
  initialIndex,
  onBack,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const containerHeight = SCREEN_HEIGHT - 120;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const handleScrollToIndexFailed = useCallback((info: { index: number }) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
      });
    }, 300);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: MediaFile; index: number }) => {
      const isImage = item.mimeType?.startsWith("image/");
      const isVideo = item.mimeType?.startsWith("video/");
      const isAudio = item.mimeType?.startsWith("audio/");
      const mediaUrl = `${API_URL}/media/chat/${item.url}`;

      return (
        <View
          style={{ width: SCREEN_WIDTH, height: containerHeight }}
          className="justify-center items-center bg-black"
        >
          {isImage && (
            <Image
              source={{ uri: mediaUrl }}
              style={{ width: SCREEN_WIDTH, height: containerHeight }}
              resizeMode="contain"
            />
          )}

          {isVideo && (
            <VideoPlayerComp file={item} isActive={index === currentIndex} />
          )}

          {isAudio && (
            <View className="flex-1 justify-center items-center p-5">
              <View className="w-44 h-44 bg-purple-600 rounded-full justify-center items-center mb-6">
                <Ionicons name="musical-notes" size={72} color="white" />
              </View>
              <Text className="text-white text-lg font-semibold text-center">
                {item.originalName}
              </Text>
              <Text className="text-gray-500 text-sm mt-2">Audio File</Text>
            </View>
          )}

          {!isImage && !isVideo && !isAudio && (
            <View className="flex-1 justify-center items-center p-5">
              <Ionicons name="document-outline" size={56} color="#666" />
              <Text className="text-white text-base font-medium text-center mt-4">
                {item.originalName}
              </Text>
              <Text className="text-gray-500 text-sm mt-2 text-center">
                {item.mimeType}
              </Text>
            </View>
          )}
        </View>
      );
    },
    [currentIndex, containerHeight]
  );

  const currentFile = files[currentIndex];

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-white border-b border-neutral-200">

<TouchableOpacity onPress={onBack}>
  <Ionicons name="close" size={28} color="black" />
</TouchableOpacity>

<Text className="text-black text-lg font-semibold">
  {currentIndex + 1} / {files.length}
</Text>

<View style={{ width: 28 }} />

</View>

      {/* Horizontal FlatList */}
      <FlatList
        ref={flatListRef}
        data={files}
        renderItem={renderItem}
        keyExtractor={(item, i) => `fs-${i}-${item.url}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        initialScrollIndex={initialIndex}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={Platform.OS !== "web"}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
      />

      {/* Pagination */}
      {files.length > 1 && (
        <View className="absolute bottom-8 left-0 right-0 items-center">
          {files.length <= 15 ? (
            <View className="flex-row items-center justify-center">
              {files.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === currentIndex ? 9 : 6,
                    height: i === currentIndex ? 9 : 6,
                    borderRadius: 5,
                    backgroundColor:
                      i === currentIndex ? "#fff" : "rgba(255,255,255,0.35)",
                    marginHorizontal: 3,
                  }}
                />
              ))}
            </View>
          ) : (
            <View className="bg-black/70 px-4 py-1.5 rounded-full">
              <Text className="text-white text-sm font-medium">
                {currentIndex + 1} of {files.length}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
// ─── Main Modal ──────────────────────────────────────────────────────────────
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
  const [viewMode, setViewMode] = useState<"gallery" | "fullscreen">("gallery");
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setViewMode("gallery");
      setSelectedIndex(initialIndex);

      if (mediaFiles && mediaFiles.length > 0) {
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
        fetchMediaData();
      }
    } else {
      setMediaData(null);
      setViewMode("gallery");
      setSelectedIndex(0);
      setError(null);
    }
  }, [visible, mediaId, mediaFiles, initialIndex]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (viewMode === "fullscreen") {
        setViewMode("gallery");
        return true;
      }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, viewMode, onClose]);

  const fetchMediaData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMediaFiles(mediaId!);
      if (data.success) {
        setMediaData(data.media);
      } else {
        setError("Failed to load media files");
      }
    } catch (err: any) {
      console.error("Error fetching media:", err);
      setError(err.response?.data?.error || "Failed to load media files");
    } finally {
      setLoading(false);
    }
  };

  const handleMediaPress = useCallback((index: number) => {
    setSelectedIndex(index);
    setViewMode("fullscreen");
  }, []);

  const handleBackToGallery = useCallback(() => {
    setViewMode("gallery");
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (viewMode === "fullscreen") {
          handleBackToGallery();
        } else {
          onClose();
        }
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {viewMode === "fullscreen" && mediaData ? (
        <FullScreenViewer
          files={mediaData.files}
          initialIndex={selectedIndex}
          onBack={handleBackToGallery}
        />
      ) : (
        <GalleryView
          files={mediaData?.files || []}
          onClose={onClose}
          onMediaPress={handleMediaPress}
          loading={loading}
          error={error}
          onRetry={fetchMediaData}
        />
      )}
    </Modal>
  );
}