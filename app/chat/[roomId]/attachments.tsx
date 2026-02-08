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
  Keyboard,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  useWindowDimensions,
  Modal,
  ScrollView,
  LayoutAnimation,
} from "react-native";
import { BackHandler } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Line, Circle } from "react-native-svg";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";
import { router, useLocalSearchParams } from "expo-router";
import { TabView, TabBar } from "react-native-tab-view";
import PollContent from "@/components/chat/PollContent";
import CameraScreen from "@/components/chat/CameraScreen";
import { Video, ResizeMode } from "expo-av";

import {
  RichEditor,
  RichToolbar,
  actions,
  cleanHtml,
  stripHtml,
  isHtmlContent,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  BulletListIcon,
  NumberListIcon,
  ColorIndicatorIcon,
  InlineColorPicker,
  InlineLinkInput,
  AnimatedToolbar,
  ToolbarButton,
  ToolbarDivider,
} from "@/components/chat/message";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const SELECTED_THUMB_SIZE = 64;

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
  const prevLengthRef = useRef(selectedMedia.length);

  // Sync to initialIndex when modal opens
  useEffect(() => {
    if (visible && initialIndex >= 0 && selectedMedia.length > 0) {
      const safeIndex = Math.min(initialIndex, selectedMedia.length - 1);
      setCurrentIndex(safeIndex);
      prevLengthRef.current = selectedMedia.length;
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: safeIndex,
          animated: false,
        });
      }, 100);
    }
  }, [visible, initialIndex]);

  // When selection list changes (delete): adjust currentIndex and scroll
  useEffect(() => {
    if (!visible || selectedMedia.length === 0) return;
    const prevLen = prevLengthRef.current;
    prevLengthRef.current = selectedMedia.length;

    if (selectedMedia.length < prevLen) {
      // Item was removed
      const newIndex = currentIndex >= selectedMedia.length
        ? Math.max(0, selectedMedia.length - 1)
        : currentIndex;
      setCurrentIndex(newIndex);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: newIndex,
          animated: false,
        });
      }, 50);
    }
  }, [selectedMedia.length, visible]);

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / SCREEN_WIDTH);
      if (idx >= 0 && idx < selectedMedia.length) {
        setCurrentIndex(idx);
      }
    },
    [selectedMedia.length]
  );

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

  const handleRemoveCurrent = useCallback(() => {
    const media = selectedMedia[currentIndex];
    if (!media) return;
    if (selectedMedia.length === 1) {
      onRemove(media.id);
      onClose();
      return;
    }
    onRemove(media.id);
  }, [currentIndex, selectedMedia, onRemove, onClose]);

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
            onPress={handleRemoveCurrent}
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
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

// ---------- SELECTED MEDIA THUMBNAIL ----------
const SelectedMediaThumbnail = React.memo(({
  item,
  onPress,
  onRemove,
}: {
  item: SelectedMedia;
  onPress: () => void;
  onRemove: () => void;
}) => {
  const isVideo = item.mediaType === "video";

  return (
    <TouchableOpacity
      style={{ width: SELECTED_THUMB_SIZE, height: SELECTED_THUMB_SIZE }}
      className="rounded-lg overflow-hidden bg-gray-200 mr-2"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.uri }}
        className="w-full h-full"
        resizeMode="cover"
      />
      {isVideo && (
        <View className="absolute bottom-1 left-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center">
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      )}
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
    </TouchableOpacity>
  );
});

// ---------- TOOLBAR BUTTON ----------
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

  // Preview modal state
  const [previewAsset, setPreviewAsset] = useState<MediaLibrary.Asset | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Selected media carousel state
  const [showCarouselModal, setShowCarouselModal] = useState(false);
  const [carouselInitialIndex, setCarouselInitialIndex] = useState(0);

  // Rich text state
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'background' | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [inputHeight, setInputHeight] = useState(44);
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [currentBgColor, setCurrentBgColor] = useState('#FFFFFF');
  const [formatActive, setFormatActive] = useState({ bold: false, italic: false, underline: false });

  // Refs
  const richTextRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const heightUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSwitchingRef = useRef(false);
  const editorKeyRef = useRef(0);

  // Request permission and load media on mount
  useEffect(() => {
    if (hasPermission === null) {
      requestPermissionAndLoadMedia();
    }
  }, [hasPermission]);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });

    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardShowListener?.remove();
      keyboardHideListener?.remove();
    };
  }, []);

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
      router.replace({
        pathname: "/chat/[roomId]",
        params: { roomId },
      });
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
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

  const handleRemoveMedia = useCallback((id: string) => {
    setSelectedMedia(prev => {
      const newSelection = prev.filter(m => m.id !== id);
      return newSelection.map((item, index) => ({ ...item, order: index + 1 }));
    });
  }, []);

  const handlePreviewMedia = useCallback((asset: MediaLibrary.Asset) => {
    setPreviewAsset(asset);
    setShowPreviewModal(true);
  }, []);

  const handleOpenCarousel = useCallback((index: number) => {
    setCarouselInitialIndex(index);
    setShowCarouselModal(true);
  }, []);

  const getSelectedOrder = useCallback((id: string): number | null => {
    const item = selectedMedia.find(m => m.id === id);
    return item ? item.order : null;
  }, [selectedMedia]);

  // Rich text toggle
  const handleToggleRichText = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (isSwitchingRef.current) return;

    isSwitchingRef.current = true;
    const nextState = !showRichTextToolbar;
    const shouldFocusAfter = isKeyboardVisible;

    setShowColorPicker(null);
    setShowLinkInput(false);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowRichTextToolbar(nextState);

    if (nextState) {
      const htmlContent = caption ? caption.replace(/\n/g, '<br>') : '';
      const finalHtml = htmlContent ? `<div>${htmlContent}</div>` : '';

      setTimeout(() => {
        if (richTextRef.current) {
          richTextRef.current.setContentHTML(finalHtml);
          if (shouldFocusAfter) {
            setTimeout(() => {
              richTextRef.current?.focusContentEditor();
              isSwitchingRef.current = false;
            }, 150);
          } else {
            isSwitchingRef.current = false;
          }
        } else {
          isSwitchingRef.current = false;
        }
      }, 50);
    } else {
      const plainText = stripHtml(caption);
      setCaption(plainText);

      setTimeout(() => {
        if (shouldFocusAfter && inputRef.current) {
          inputRef.current.focus();
        }
        isSwitchingRef.current = false;
      }, 100);
    }
  }, [showRichTextToolbar, caption, isKeyboardVisible]);

  // Color picker handlers
  const handleColorSelect = useCallback((color: string) => {
    if (showColorPicker === 'text') {
      richTextRef.current?.setForeColor(color);
      setCurrentTextColor(color);
    } else if (showColorPicker === 'background') {
      richTextRef.current?.setHiliteColor(color);
      setCurrentBgColor(color);
    }
    setShowColorPicker(null);
    
    setTimeout(() => {
      richTextRef.current?.focusContentEditor();
    }, 50);
  }, [showColorPicker]);

  const toggleColorPicker = useCallback((type: 'text' | 'background') => {
    setShowLinkInput(false);
    setShowColorPicker(prev => prev === type ? null : type);
  }, []);

  const toggleLinkInput = useCallback(() => {
    setShowColorPicker(null);
    setShowLinkInput(prev => !prev);
  }, []);

  const handleInsertLink = useCallback((url: string, text: string) => {
    if (showRichTextToolbar && richTextRef.current) {
      richTextRef.current?.insertLink(text, url);
    } else {
      setCaption(prev => prev + ` ${url} `);
    }
  }, [showRichTextToolbar]);

  const handleBold = useCallback(() => {
    richTextRef.current?.sendAction(actions.setBold, 'result');
    setFormatActive(prev => ({ ...prev, bold: !prev.bold }));
  }, []);
  const handleItalic = useCallback(() => {
    richTextRef.current?.sendAction(actions.setItalic, 'result');
    setFormatActive(prev => ({ ...prev, italic: !prev.italic }));
  }, []);
  const handleUnderline = useCallback(() => {
    richTextRef.current?.sendAction(actions.setUnderline, 'result');
    setFormatActive(prev => ({ ...prev, underline: !prev.underline }));
  }, []);

  const handlePaste = useCallback((data: string) => {
    if (!data || !richTextRef.current) return;
    if (isHtmlContent(data)) {
      richTextRef.current.insertHTML(data);
    }
  }, []);

  // Send media
  const handleSendMedia = async () => {
    if (selectedMedia.length === 0 || isSending) return;
    setIsSending(true);

    try {
      const token = await AuthStorage.getToken();
      const formData = new FormData();

      selectedMedia.forEach((media) => {
        const uri = Platform.OS === "ios" ? media.uri.replace("file://", "") : media.uri;
        const mimeType = getMimeType(media.filename, media.mediaType);

        // @ts-ignore
        formData.append("files", {
          uri: uri,
          name: media.filename,
          type: mimeType,
        });
      });

      const uploadResponse = await axios.post(
        `${API_URL}/api/vm-media/upload-multipart`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          transformRequest: (data) => data,
        }
      );

      if (!uploadResponse.data.success) {
        throw new Error("Gallery upload failed");
      }

      const tempFolderId = uploadResponse.data.tempFolderId;
      const uploadedFiles = uploadResponse.data.uploadedFiles;

      const cleanedCaption = showRichTextToolbar ? cleanHtml(caption) : caption.trim();

      const filesWithCaptions = uploadedFiles.map((f: any) => ({
        fileName: f.fileName,
        originalName: f.originalName,
        caption: cleanedCaption,
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
          caption: cleanedCaption,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (moveResponse.data.success) {
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
        router.back();
      }
    } catch (error: any) {
      console.error("Error sending gallery media:", error);
      Alert.alert("Error", `Failed to send media: ${error?.message || "Check connection"}`);
    } finally {
      setIsSending(false);
    }
  };

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
    setShowCamera(true);
  }, []);

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

  const maxInputHeight = 120;
  const shouldShowToolbar = showRichTextToolbar && Platform.OS !== 'web' && RichToolbar;

  // Render selected media thumbnails bar
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
          />
        )}
      />
    </View>
  );

  // Render input bar
  const renderInputBar = () => (
    <View className="pb-2">
      {/* Selected media thumbnails */}
      {renderSelectedMediaBar()}

      {/* Input row */}
      <View className="flex-row items-end px-3 pt-2.5 gap-2">
        {/* Format toggle button */}
        {Platform.OS !== 'web' && RichEditor && (
          <TouchableOpacity
            onPress={handleToggleRichText}
            className={`w-10 h-11 rounded-full items-center justify-center ${
              showRichTextToolbar ? 'bg-blue-100' : 'bg-gray-100'
            }`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="text"
              size={20}
              color={showRichTextToolbar ? '#2AABEE' : '#666666'}
            />
          </TouchableOpacity>
        )}

        {/* Input container */}
        <View className="flex-1 bg-gray-50 rounded-3xl border border-gray-200 overflow-hidden min-h-[44px]">
          {showRichTextToolbar && Platform.OS !== 'web' && RichEditor ? (
            <View style={{ minHeight: 44, maxHeight: maxInputHeight }}>
              <RichEditor
                key={`editor-${editorKeyRef.current}`}
                ref={richTextRef}
                onChange={setCaption}
                placeholder="Add a caption..."
                initialContentHTML=""
                initialHeight={44}
                androidHardwareAccelerationDisabled={true}
                androidLayerType="software"
                pasteAsPlainText={true}
                onPaste={handlePaste}
                editorStyle={{
                  backgroundColor: "#F9FAFB",
                  placeholderColor: "#9CA3AF",
                  contentCSSText: `
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 16px;
                    line-height: 22px;
                    color: #1F2937;
                    padding: 10px 14px;
                    min-height: 44px;
                    max-height: ${maxInputHeight}px;
                  `,
                }}
                style={{
                  backgroundColor: '#F9FAFB',
                  minHeight: 44,
                  maxHeight: maxInputHeight,
                }}
              />
            </View>
          ) : (
            <TextInput
              ref={inputRef}
              className="px-4 py-2.5 text-base text-gray-800"
              style={{ height: inputHeight, maxHeight: maxInputHeight, textAlignVertical: 'center' }}
              placeholder="Add a caption..."
              placeholderTextColor="#999"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={500}
              onContentSizeChange={(event) => {
                const contentHeight = event.nativeEvent?.contentSize?.height;
                if (!contentHeight) return;

                if (heightUpdateTimeoutRef.current) {
                  clearTimeout(heightUpdateTimeoutRef.current);
                }

                heightUpdateTimeoutRef.current = setTimeout(() => {
                  const newHeight = Math.min(Math.max(44, Math.ceil(contentHeight)), maxInputHeight);
                  if (Math.abs(newHeight - inputHeight) >= 2) {
                    setInputHeight(newHeight);
                  }
                }, 50);
              }}
            />
          )}
        </View>

        {/* Send button */}
        <TouchableOpacity
          onPress={handleSendMedia}
          disabled={isSending || selectedMedia.length === 0}
          className={`w-11 h-11 rounded-full items-center justify-center ${
            isSending || selectedMedia.length === 0 ? 'bg-gray-300' : 'bg-blue-500'
          }`}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Rich text toolbar */}
      <AnimatedToolbar visible={shouldShowToolbar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ 
            paddingHorizontal: 8, 
            paddingVertical: 4,
            alignItems: 'center',
            paddingRight: 20,
          }}
        >
          {/* Bold */}
          <ToolbarButton onPress={handleBold} isActive={formatActive.bold} activeClass="bg-blue-100">
            <Text className={`text-lg font-bold ${formatActive.bold ? 'text-blue-600' : 'text-gray-600'}`}>B</Text>
          </ToolbarButton>
          
          {/* Italic */}
          <ToolbarButton onPress={handleItalic} isActive={formatActive.italic} activeClass="bg-blue-100">
            <Text className={`text-lg italic ${formatActive.italic ? 'text-blue-600' : 'text-gray-600'}`}>I</Text>
          </ToolbarButton>
          
          {/* Underline */}
          <ToolbarButton onPress={handleUnderline} isActive={formatActive.underline} activeClass="bg-blue-100">
            <Text className={`text-lg ${formatActive.underline ? 'text-blue-600' : 'text-gray-600'}`} style={{ textDecorationLine: 'underline' }}>U</Text>
          </ToolbarButton>
          
          {/* Strikethrough */}
          <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.setStrikethrough, 'result')}>
            <Text className="text-lg text-gray-600" style={{ textDecorationLine: 'line-through' }}>S</Text>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Text Color */}
          <ToolbarButton 
            onPress={() => toggleColorPicker('text')} 
            isActive={showColorPicker === 'text'}
            activeClass="bg-blue-100"
          >
            <ColorIndicatorIcon type="text" color={currentTextColor} />
          </ToolbarButton>

          {/* Background Color */}
          <ToolbarButton 
            onPress={() => toggleColorPicker('background')} 
            isActive={showColorPicker === 'background'}
            activeClass="bg-blue-100"
          >
            <ColorIndicatorIcon type="background" color={currentBgColor} />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Link */}
          <ToolbarButton onPress={toggleLinkInput} isActive={showLinkInput} activeClass="bg-blue-100">
            <Ionicons name="link" size={22} color={showLinkInput ? '#2AABEE' : '#666'} />
          </ToolbarButton>

          {/* Bullet List */}
          <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.insertBulletsList, 'result')}>
            <BulletListIcon color="#666" />
          </ToolbarButton>

          {/* Number List */}
          <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.insertOrderedList, 'result')}>
            <NumberListIcon color="#666" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Align Left */}
          <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.alignLeft, 'result')}>
            <AlignLeftIcon color="#666" />
          </ToolbarButton>

          {/* Align Center */}
          <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.alignCenter, 'result')}>
            <AlignCenterIcon color="#666" />
          </ToolbarButton>

          {/* Align Right */}
          <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.alignRight, 'result')}>
            <AlignRightIcon color="#666" />
          </ToolbarButton>
        </ScrollView>
      </AnimatedToolbar>

      {/* Inline Color Picker - ONLY ONE, no Modal version */}
      <InlineColorPicker
        visible={showColorPicker !== null}
        type={showColorPicker}
        selectedColor={showColorPicker === 'text' ? currentTextColor : currentBgColor}
        onSelect={handleColorSelect}
        onClose={() => {
          setShowColorPicker(null);
          setTimeout(() => richTextRef.current?.focusContentEditor(), 50);
        }}
        selectedBorderClass="border-blue-500"
      />

      {/* Inline Link Input */}
      <InlineLinkInput
        visible={showLinkInput}
        onInsert={handleInsertLink}
        onClose={() => setShowLinkInput(false)}
        editorRef={richTextRef}
        accent="blue"
      />
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
            swipeEnabled={true}
          />
        </View>

        {/* Input Bar - Only shown for gallery with selected media */}
        {showInputBar && (
          <View className="border-t border-gray-200 bg-white">
            {renderInputBar()}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Media Preview Modal */}
      <MediaPreviewModal
        visible={showPreviewModal}
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

      {/* Selected Media Carousel Modal */}
      <SelectedMediaCarouselModal
        visible={showCarouselModal}
        selectedMedia={selectedMedia}
        initialIndex={carouselInitialIndex}
        onClose={() => setShowCarouselModal(false)}
        onRemove={handleRemoveMedia}
      />
    </SafeAreaView>
  );
}
