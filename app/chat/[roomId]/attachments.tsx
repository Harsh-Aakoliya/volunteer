// app/chat/[roomId]/attachments.tsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Keyboard,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  useWindowDimensions,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { BackHandler } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Line, Circle as SvgCircle } from "react-native-svg";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";
import { router, useLocalSearchParams } from "expo-router";
import { TabView, TabBar } from "react-native-tab-view";
import PollContent from "@/components/chat/PollContent";
import CameraScreen from "@/components/chat/CameraScreen";
import { Video, ResizeMode } from "expo-av";

import MessageInput from "@/components/chat/MessageInput";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const SELECTED_THUMB_SIZE = 64;

// ---------- UPLOAD STATUS TYPES ----------
type UploadStatus = 'idle' | 'pending' | 'uploading' | 'success' | 'error';

interface UploadProgress {
  [id: string]: {
    progress: number;
    status: UploadStatus;
  };
}

// ---------- ATTACHMENTS-SPECIFIC SVG ICONS ----------
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

// ---------- CIRCULAR PROGRESS COMPONENT ----------
const CircularProgress = React.memo(({
  progress,
  size = 40,
  strokeWidth = 3,
  backgroundColor = 'rgba(255,255,255,0.3)',
  progressColor = '#3b82f6',
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  backgroundColor?: string;
  progressColor?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      {/* Background circle */}
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={backgroundColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress circle */}
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={progressColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
});

// ---------- ANIMATED SPINNER ----------
const AnimatedSpinner = React.memo(({ size = 24, color = "#3b82f6" }: { size?: number; color?: string }) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Ionicons name="sync" size={size} color={color} />
    </Animated.View>
  );
});

// ---------- TYPES ----------
interface SelectedMedia {
  id: string;
  uri: string;
  filename: string;
  mediaType: "photo" | "video";
  duration?: number;
  order: number;
}

type GalleryItem = { type: "camera" } | { type: "media"; asset: MediaLibrary.Asset };

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

// ---------- MEDIA PREVIEW MODAL ----------
const MediaPreviewModal = React.memo(({
  visible,
  asset,
  onClose,
  onSelect,
  isSelected,
  selectedOrder,
}: {
  visible: boolean;
  asset: MediaLibrary.Asset | null;
  onClose: () => void;
  onSelect: () => void;
  isSelected: boolean;
  selectedOrder: number | null;
}) => {
  const videoRef = useRef<Video>(null);

  if (!asset) return null;

  const isVideo = asset.mediaType === "video";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-black/90">
          <TouchableOpacity onPress={onClose} className="w-11 h-11 items-center justify-center">
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-white text-lg font-semibold">
              {isVideo ? 'Video' : 'Photo'}
            </Text>
            {isVideo && asset.duration && (
              <Text className="text-gray-400 text-sm mt-0.5">
                {formatDuration(asset.duration)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onSelect}
            className="w-11 h-11 items-center justify-center"
          >
            {isSelected ? (
              <View className="w-7 h-7 rounded-full bg-blue-500 items-center justify-center">
                <Text className="text-white text-sm font-bold">{selectedOrder}</Text>
              </View>
            ) : (
              <Ionicons name="add-circle-outline" size={28} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="flex-1 items-center justify-center">
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: asset.uri }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 200 }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={visible}
              isLooping={false}
            />
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 200 }}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Bottom action */}
        <View className="px-5 py-4 bg-black/90">
          <TouchableOpacity
            onPress={() => {
              onSelect();
              onClose();
            }}
            className={`flex-row items-center justify-center py-3.5 rounded-xl ${
              isSelected ? 'bg-red-500' : 'bg-blue-500'
            }`}
          >
            <Ionicons
              name={isSelected ? "checkmark-circle" : "add-circle"}
              size={24}
              color="#fff"
            />
            <Text className="text-white text-base font-semibold ml-2">
              {isSelected ? 'Deselect' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
});

// ---------- SELECTED MEDIA CAROUSEL MODAL ----------
const SelectedMediaCarouselModal = React.memo(({
  visible,
  selectedMedia,
  initialIndex,
  onClose,
  onRemove,
}: {
  visible: boolean;
  selectedMedia: SelectedMedia[];
  initialIndex: number;
  onClose: () => void;
  onRemove: (id: string) => void;
}) => {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible && initialIndex >= 0) {
      setCurrentIndex(initialIndex);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 100);
    }
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
      }, 500);
    },
    []
  );

  const currentMedia = selectedMedia[currentIndex];

  const renderItem = useCallback(({ item }: { item: SelectedMedia }) => {
    const isVideo = item.mediaType === "video";

    return (
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 180 }} className="items-center justify-center">
        {isVideo ? (
          <Video
            source={{ uri: item.uri }}
            style={{ width: SCREEN_WIDTH, height: '100%' }}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay={false}
          />
        ) : (
          <Image
            source={{ uri: item.uri }}
            style={{ width: SCREEN_WIDTH, height: '100%' }}
            resizeMode="contain"
          />
        )}
      </View>
    );
  }, []);

  if (!visible || selectedMedia.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-black/90">
          <TouchableOpacity onPress={onClose} className="w-11 h-11 items-center justify-center">
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-white text-lg font-semibold">
              {currentIndex + 1} / {selectedMedia.length}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (currentMedia) {
                onRemove(currentMedia.id);
                if (selectedMedia.length === 1) {
                  onClose();
                }
              }
            }}
            className="w-11 h-11 items-center justify-center"
          >
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Carousel */}
        <FlatList
          ref={flatListRef}
          data={selectedMedia}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
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

        {/* Pagination dots */}
        {selectedMedia.length > 1 && selectedMedia.length <= 10 && (
          <View className="flex-row justify-center items-center py-4 gap-1.5">
            {selectedMedia.map((_, index) => (
              <View
                key={index}
                className={`rounded-full ${
                  index === currentIndex 
                    ? 'w-2.5 h-2.5 bg-blue-500' 
                    : 'w-2 h-2 bg-white/40'
                }`}
              />
            ))}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
});

// ---------- CAMERA ITEM ----------
const CameraItem = React.memo(({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    style={{ width: ITEM_SIZE, height: ITEM_SIZE, margin: ITEM_MARGIN / 2 }}
    className="bg-gray-100 rounded items-center justify-center"
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name="camera" size={32} color="#666" />
    <Text className="mt-2 text-xs text-gray-500">Camera</Text>
  </TouchableOpacity>
));

// ---------- MEDIA ITEM ----------
const MediaItem = React.memo(({
  item,
  selectedOrder,
  onSelect,
  onPreview,
}: {
  item: MediaLibrary.Asset;
  selectedOrder: number | null;
  onSelect: (asset: MediaLibrary.Asset) => void;
  onPreview: (asset: MediaLibrary.Asset) => void;
}) => {
  const isSelected = selectedOrder !== null;
  const isVideo = item.mediaType === "video";

  return (
    <TouchableOpacity
      style={{ width: ITEM_SIZE, height: ITEM_SIZE, margin: ITEM_MARGIN / 2 }}
      className="rounded overflow-hidden bg-gray-900"
      onPress={() => onPreview(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.uri }}
        className="flex-1 rounded"
        resizeMode="cover"
      />

      {isVideo && (
        <View className="absolute inset-0 bg-black/15 rounded items-center justify-center">
          <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
        </View>
      )}

      {isVideo && (
        <View className="absolute bottom-1.5 left-1.5 bg-black/75 px-1.5 py-0.5 rounded flex-row items-center">
          <Ionicons name="videocam" size={12} color="white" />
          <Text className="text-white text-[11px] font-semibold ml-1">
            {formatDuration(item.duration || 0)}
          </Text>
        </View>
      )}

      <TouchableOpacity
        className={`absolute top-2 right-2 w-6 h-6 rounded-full items-center justify-center border-2 ${
          isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/30 border-white'
        }`}
        onPress={(e) => {
          e.stopPropagation();
          onSelect(item);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {isSelected && (
          <Text className="text-white text-xs font-bold">{selectedOrder}</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ---------- SELECTED MEDIA THUMBNAIL WITH UPLOAD PROGRESS ----------
const SelectedMediaThumbnail = React.memo(({
  item,
  onPress,
  onRemove,
  uploadState,
  isUploading,
}: {
  item: SelectedMedia;
  onPress: () => void;
  onRemove: () => void;
  uploadState?: { progress: number; status: UploadStatus };
  isUploading: boolean;
}) => {
  const isVideo = item.mediaType === "video";
  const status = uploadState?.status || 'idle';
  const progress = uploadState?.progress || 0;

  const showProgress = isUploading && (status === 'pending' || status === 'uploading');
  const showSuccess = status === 'success';
  const showError = status === 'error';

  return (
    <TouchableOpacity
      style={{ width: SELECTED_THUMB_SIZE, height: SELECTED_THUMB_SIZE }}
      className="rounded-lg overflow-hidden bg-gray-200 mr-2"
      onPress={isUploading ? undefined : onPress}
      activeOpacity={isUploading ? 1 : 0.8}
      disabled={isUploading}
    >
      <Image
        source={{ uri: item.uri }}
        className="w-full h-full"
        resizeMode="cover"
      />

      {/* Video indicator */}
      {isVideo && !isUploading && (
        <View className="absolute bottom-1 left-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center">
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      )}

      {/* Normal state - Order badge and remove button */}
      {!isUploading && (
        <>
          <View className="absolute top-1 left-1 bg-blue-500 rounded-full w-5 h-5 items-center justify-center">
            <Text className="text-white text-[11px] font-bold">{item.order}</Text>
          </View>
          <TouchableOpacity
            className="absolute -top-0.5 -right-0.5 bg-black/50 rounded-full"
            onPress={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* Upload progress overlay */}
      {showProgress && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center">
          <View className="relative items-center justify-center">
            <CircularProgress
              progress={progress}
              size={44}
              strokeWidth={3}
              backgroundColor="rgba(255,255,255,0.3)"
              progressColor="#3b82f6"
            />
            <View className="absolute items-center justify-center">
              <Text className="text-white text-[10px] font-bold">
                {Math.round(progress)}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Success overlay */}
      {showSuccess && (
        <View className="absolute inset-0 bg-green-500/60 items-center justify-center">
          <View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center">
            <Ionicons name="checkmark" size={22} color="#fff" />
          </View>
        </View>
      )}

      {/* Error overlay */}
      {showError && (
        <View className="absolute inset-0 bg-red-500/60 items-center justify-center">
          <View className="w-8 h-8 rounded-full bg-red-500 items-center justify-center">
            <Ionicons name="alert" size={20} color="#fff" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ---------- UPLOAD PROGRESS BAR (for entire upload) ----------
const OverallProgressBar = React.memo(({
  progress,
  currentFile,
  totalFiles,
  status,
}: {
  progress: number;
  currentFile: number;
  totalFiles: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
}) => {
  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return `Uploading ${currentFile} of ${totalFiles}...`;
      case 'processing':
        return 'Processing...';
      case 'complete':
        return 'Complete!';
      case 'error':
        return 'Upload failed';
      default:
        return 'Preparing...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <View className="px-4 py-3 bg-gray-50">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          {status === 'uploading' && <AnimatedSpinner size={16} color="#3b82f6" />}
          {status === 'processing' && <AnimatedSpinner size={16} color="#3b82f6" />}
          {status === 'complete' && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
          {status === 'error' && <Ionicons name="alert-circle" size={16} color="#ef4444" />}
          <Text className="ml-2 text-sm font-medium text-gray-700">
            {getStatusText()}
          </Text>
        </View>
        <Text className="text-sm font-semibold text-gray-600">
          {Math.round(progress)}%
        </Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${getStatusColor()}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </View>
    </View>
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

  // Upload progress state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');

  // Preview modal state
  const [previewAsset, setPreviewAsset] = useState<MediaLibrary.Asset | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Selected media carousel state
  const [showCarouselModal, setShowCarouselModal] = useState(false);
  const [carouselInitialIndex, setCarouselInitialIndex] = useState(0);


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
      if (isUploading) {
        Alert.alert(
          "Upload in Progress",
          "Please wait for the upload to complete before leaving.",
          [{ text: "OK" }]
        );
        return true;
      }
      router.replace({
        pathname: "/chat/[roomId]",
        params: { roomId },
      });
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [roomId, isUploading]);

  const loadMedia = async (cursor?: string) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (Platform.OS === "android" && !cursor) {
        const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
        const perAlbumLimit = 80;
        const allAssets: MediaLibrary.Asset[] = [];
        const seenIds = new Set<string>();

        const albumPromises = albums.map(async (album) => {
          try {
            const result = await MediaLibrary.getAssetsAsync({
              first: perAlbumLimit,
              album,
              mediaType: ["photo", "video"],
              sortBy: ["creationTime"],
            });
            return result.assets;
          } catch {
            return [];
          }
        });

        const albumResults = await Promise.all(albumPromises);
        for (const assets of albumResults) {
          for (const asset of assets) {
            if (!seenIds.has(asset.id)) {
              seenIds.add(asset.id);
              allAssets.push(asset);
            }
          }
        }

        allAssets.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));

        setMediaAssets(allAssets);
        setEndCursor(undefined);
        setHasMore(false);
      } else if (cursor) {
        const result = await MediaLibrary.getAssetsAsync({
          first: 30,
          after: cursor,
          mediaType: ["photo", "video"],
          sortBy: ["creationTime"],
        });
        setMediaAssets(prev => [...prev, ...result.assets]);
        setEndCursor(result.endCursor);
        setHasMore(result.hasNextPage);
      } else {
        const result = await MediaLibrary.getAssetsAsync({
          first: 30,
          mediaType: ["photo", "video"],
          sortBy: ["creationTime"],
        });
        setMediaAssets(result.assets);
        setEndCursor(result.endCursor);
        setHasMore(result.hasNextPage);
      }
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
    if (isUploading) return;
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
  }, [isUploading]);

  const handleRemoveMedia = useCallback((id: string) => {
    if (isUploading) return;
    setSelectedMedia(prev => {
      const newSelection = prev.filter(m => m.id !== id);
      return newSelection.map((item, index) => ({ ...item, order: index + 1 }));
    });
  }, [isUploading]);

  const handlePreviewMedia = useCallback((asset: MediaLibrary.Asset) => {
    if (isUploading) return;
    setPreviewAsset(asset);
    setShowPreviewModal(true);
  }, [isUploading]);

  const handleOpenCarousel = useCallback((index: number) => {
    if (isUploading) return;
    setCarouselInitialIndex(index);
    setShowCarouselModal(true);
  }, [isUploading]);

  const getSelectedOrder = useCallback((id: string): number | null => {
    const item = selectedMedia.find(m => m.id === id);
    return item ? item.order : null;
  }, [selectedMedia]);

  // Reset upload state
  const resetUploadState = useCallback(() => {
    setIsUploading(false);
    setUploadProgress({});
    setOverallProgress(0);
    setCurrentUploadIndex(0);
    setUploadPhase('idle');
  }, []);


  // Send media with progress tracking
  const handleSendMedia = async (captionText: string = '') => {
    if (selectedMedia.length === 0 || isSending || isUploading) return;
    
    Keyboard.dismiss();
    
    // Initialize upload state
    setIsUploading(true);
    setIsSending(true);
    setUploadPhase('uploading');
    setOverallProgress(0);
    setCurrentUploadIndex(0);

    // Initialize progress for all media
    const initialProgress: UploadProgress = {};
    selectedMedia.forEach(media => {
      initialProgress[media.id] = { progress: 0, status: 'pending' };
    });
    setUploadProgress(initialProgress);

    try {
      const token = await AuthStorage.getToken();
      const formData = new FormData();
      const totalFiles = selectedMedia.length;

      // Prepare form data
      selectedMedia.forEach((media, index) => {
        const uri = Platform.OS === "ios" ? media.uri.replace("file://", "") : media.uri;
        const mimeType = getMimeType(media.filename, media.mediaType);

        // @ts-ignore
        formData.append("files", {
          uri: uri,
          name: media.filename,
          type: mimeType,
        });
      });

      // Upload with progress tracking
      const uploadResponse = await axios.post(
        `${API_URL}/api/vm-media/upload-multipart`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          transformRequest: (data) => data,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentComplete = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setOverallProgress(percentComplete * 0.7); // 70% for upload
              
              // Update individual file progress (simulated based on overall)
              const progressPerFile = 100 / totalFiles;
              const currentFileIndex = Math.min(
                Math.floor(percentComplete / progressPerFile),
                totalFiles - 1
              );
              
              setCurrentUploadIndex(currentFileIndex);
              
              setUploadProgress(prev => {
                const updated = { ...prev };
                selectedMedia.forEach((media, idx) => {
                  if (idx < currentFileIndex) {
                    updated[media.id] = { progress: 100, status: 'success' };
                  } else if (idx === currentFileIndex) {
                    const fileProgress = ((percentComplete - (idx * progressPerFile)) / progressPerFile) * 100;
                    updated[media.id] = { progress: Math.min(fileProgress, 100), status: 'uploading' };
                  } else {
                    updated[media.id] = { progress: 0, status: 'pending' };
                  }
                });
                return updated;
              });
            }
          },
          timeout: 300000, // 5 minutes timeout for large files
        }
      );

      if (!uploadResponse.data.success) {
        throw new Error("Gallery upload failed");
      }

      // Mark all as uploaded, move to processing
      setUploadPhase('processing');
      setOverallProgress(75);
      setUploadProgress(prev => {
        const updated = { ...prev };
        selectedMedia.forEach(media => {
          updated[media.id] = { progress: 100, status: 'uploading' };
        });
        return updated;
      });

      const tempFolderId = uploadResponse.data.tempFolderId;
      const uploadedFiles = uploadResponse.data.uploadedFiles;

      const cleanedCaption = captionText;

      const filesWithCaptions = uploadedFiles.map((f: any) => ({
        fileName: f.fileName,
        originalName: f.originalName,
        caption: cleanedCaption,
        mimeType: f.mimeType,
        size: f.size,
      }));

      setOverallProgress(85);

      const moveResponse = await axios.post(
        `${API_URL}/api/vm-media/move-to-chat`,
        {
          tempFolderId,
          roomId,
          senderId: userId,
          filesWithCaptions,
          caption: cleanedCaption,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (moveResponse.data.success) {
        // Mark all as success
        setUploadPhase('complete');
        setOverallProgress(100);
        setUploadProgress(prev => {
          const updated = { ...prev };
          selectedMedia.forEach(media => {
            updated[media.id] = { progress: 100, status: 'success' };
          });
          return updated;
        });

        socketSendMessage(roomId, {
          id: moveResponse.data.messageId,
          messageText: moveResponse.data.messageText || "",
          createdAt: moveResponse.data.createdAt || new Date().toISOString(),
          messageType: "media",
          mediaFilesId: moveResponse.data.mediaId,
          pollId: 0,
          tableId: 0,
          replyMessageId: 0,
        });

        // Small delay to show success state before navigating
        setTimeout(() => {
          router.back();
        }, 800);
      } else {
        throw new Error("Failed to process media");
      }
    } catch (error: any) {
      console.error("Error sending gallery media:", error);
      
      // Mark all as error
      setUploadPhase('error');
      setUploadProgress(prev => {
        const updated = { ...prev };
        selectedMedia.forEach(media => {
          if (updated[media.id]?.status !== 'success') {
            updated[media.id] = { progress: 0, status: 'error' };
          }
        });
        return updated;
      });

      // Show error alert
      Alert.alert(
        "Upload Failed",
        `Failed to send media: ${error?.message || "Please check your connection and try again"}`,
        [
          {
            text: "OK",
            onPress: () => {
              // Reset upload state to allow retry
              resetUploadState();
            }
          }
        ]
      );
    } finally {
      setIsSending(false);
    }
  };

  // Retry upload
  const handleRetry = useCallback(() => {
    resetUploadState();
  }, [resetUploadState]);

  // Camera send handler
  const handleCameraSend = useCallback(async (
    uri: string, 
    mediaType: 'photo' | 'video', 
    duration?: number, 
    cameraCaption?: string
  ) => {
    if (isSending) return;
    setIsSending(true);

    try {
      const token = await AuthStorage.getToken();
      const filename = uri.split('/').pop() || `camera_${Date.now()}.${mediaType === 'photo' ? 'jpg' : 'mp4'}`;
      const mimeType = getMimeType(filename, mediaType);

      const formData = new FormData();

      // @ts-ignore
      formData.append("file", {
        uri: Platform.OS === "ios" ? uri.replace("file://", "") : uri,
        name: filename,
        type: mimeType,
      });

      formData.append("roomId", roomId);
      formData.append("senderId", userId);
      if (cameraCaption) formData.append("caption", cameraCaption);
      if (duration) formData.append("duration", String(duration));

      const response = await axios.post(
        `${API_URL}/api/vm-media/move-to-chat-camera`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          transformRequest: (data) => data,
          timeout: 120000,
        }
      );

      if (response.data.success) {
        socketSendMessage(roomId, {
          id: response.data.messageId,
          messageText: response.data.messageText || "",
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
    router.back();
  }, []);

  const handleBackToGallery = useCallback(() => {
    setIndex(0);
  }, []);

  const handleCameraPress = useCallback(() => {
    if (isUploading) return;
    setShowCamera(true);
  }, [isUploading]);

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
        onPreview={handlePreviewMedia}
      />
    );
  }, [getSelectedOrder, handleSelectMedia, handlePreviewMedia, handleCameraPress]);

  const keyExtractor = useCallback((item: GalleryItem, idx: number) =>
    item.type === "camera" ? "camera" : item.asset.id, []);

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
            contentContainerStyle={{ paddingHorizontal: ITEM_MARGIN }}
            onEndReached={loadMoreMedia}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoading ? (
                <View className="py-5 items-center">
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
      default:
        return null;
    }
  }, [galleryData, renderGalleryItem, keyExtractor, loadMoreMedia, isLoading, roomId, userId, handleSuccess, handleBackToGallery]);

  // Custom TabBar
  const renderTabBar = useCallback((props: any) => (
    <TabBar
      {...props}
      indicatorStyle={{ backgroundColor: '#3b82f6', height: 3, borderRadius: 1.5 }}
      style={{ backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}
      tabStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      labelStyle={{ fontWeight: '600', fontSize: 13, textTransform: 'none' }}
      inactiveColor="#6b7280"
      activeColor="#3b82f6"
      scrollEnabled={false}
      bounces={true}
      pressColor="rgba(59, 130, 246, 0.1)"
      renderLabel={({ route, focused, color }: { route: { key: string; title: string }; focused: boolean; color: string }) => {
        let icon;
        switch (route.key) {
          case 'gallery':
            icon = <GalleryIcon size={20} color={color} />;
            break;
          case 'poll':
            icon = <PollIcon size={20} color={color} />;
            break;
          default:
            icon = null;
        }
        return (
          <View className="flex-row items-center justify-center gap-1.5">
            {icon}
            <Text style={{ color, fontWeight: '600', fontSize: 13 }}>
              {route.title}
            </Text>
          </View>
        );
      }}
    />
  ), []);


  // Render selected media thumbnails bar with upload progress
  const renderSelectedMediaBar = () => (
    <View className="border-b border-gray-200 bg-gray-50">
      <FlatList
        data={selectedMedia}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
        renderItem={({ item, index }) => (
          <SelectedMediaThumbnail
            item={item}
            onPress={() => handleOpenCarousel(index)}
            onRemove={() => handleRemoveMedia(item.id)}
            uploadState={uploadProgress[item.id]}
            isUploading={isUploading}
          />
        )}
      />
    </View>
  );

  // Render overall progress bar
  const renderProgressBar = () => {
    if (!isUploading || uploadPhase === 'idle') return null;

    return (
      <OverallProgressBar
        progress={overallProgress}
        currentFile={currentUploadIndex + 1}
        totalFiles={selectedMedia.length}
        status={uploadPhase === 'complete' ? 'complete' : uploadPhase === 'error' ? 'error' : uploadPhase}
      />
    );
  };

  // Render input bar
  const renderInputBar = () => {
    // Hide input controls when uploading (but show thumbnails and progress)
    if (isUploading) {
      return (
        <View className="pb-2">
          {/* Selected media thumbnails with progress */}
          {renderSelectedMediaBar()}
          
          {/* Overall progress bar */}
          {renderProgressBar()}

          {/* Error retry button */}
          {uploadPhase === 'error' && (
            <View className="px-4 py-3">
              <TouchableOpacity
                onPress={handleRetry}
                className="flex-row items-center justify-center py-3 bg-blue-500 rounded-xl"
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text className="text-white font-semibold ml-2">Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel button (only during upload, not on error) */}
          {uploadPhase !== 'error' && uploadPhase !== 'complete' && (
            <View className="px-4 py-2">
              <Text className="text-center text-gray-500 text-sm">
                Please wait while uploading...
              </Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <View className="pb-2">
        {renderSelectedMediaBar()}
        <MessageInput
          messageText={caption}
          onChangeText={setCaption}
          onSend={(text) => handleSendMedia(text)}
          placeholder="Add a caption..."
          sending={isSending}
          showAttachmentButton={false}
          showAudioButton={false}
          showScheduleOption={false}
          allowEmptySend={true}
          containerClassName="bg-white w-full pb-1"
        />
      </View>
    );
  };

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
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Tab View */}
        <View className="flex-1">
          <TabView
            navigationState={{ index, routes }}
            renderScene={renderScene}
            onIndexChange={setIndex}
            initialLayout={{ width: layout.width }}
            renderTabBar={renderTabBar}
            lazy={true}
            lazyPreloadDistance={0}
            swipeEnabled={!isUploading}
          />
        </View>

        {/* Input Bar - Only shown for gallery with selected media */}
        {showInputBar && (
          <View className="border-t border-gray-200 bg-white">
            {renderInputBar()}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Media Preview Modal - disabled during upload */}
      <MediaPreviewModal
        visible={showPreviewModal && !isUploading}
        asset={previewAsset}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewAsset(null);
        }}
        onSelect={() => {
          if (previewAsset) {
            handleSelectMedia(previewAsset);
          }
        }}
        isSelected={previewAsset ? getSelectedOrder(previewAsset.id) !== null : false}
        selectedOrder={previewAsset ? getSelectedOrder(previewAsset.id) : null}
      />

      {/* Selected Media Carousel Modal - disabled during upload */}
      <SelectedMediaCarouselModal
        visible={showCarouselModal && !isUploading}
        selectedMedia={selectedMedia}
        initialIndex={carouselInitialIndex}
        onClose={() => setShowCarouselModal(false)}
        onRemove={handleRemoveMedia}
      />
    </SafeAreaView>
  );
}