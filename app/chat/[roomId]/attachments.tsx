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
  Modal,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { BackHandler } from "react-native";

import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";
import { router, useLocalSearchParams } from "expo-router";
import { TabView, TabBar } from "react-native-tab-view";
import PollContent from "@/components/chat/PollContent";
import CameraScreen from "@/components/chat/CameraScreen";
import { Video, ResizeMode } from "expo-av";

// ---------- RICH TEXT EDITOR IMPORTS ----------
let RichEditor: any = null;
let RichToolbar: any = null;
let actions: any = {};

if (Platform.OS !== 'web') {
  try {
    const richEditorModule = require('react-native-pell-rich-editor');
    RichEditor = richEditorModule.RichEditor;
    RichToolbar = richEditorModule.RichToolbar;
    actions = richEditorModule.actions;
  } catch (e) {
    console.warn('react-native-pell-rich-editor not available');
  }
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const SELECTED_THUMB_SIZE = 64;

// ---------- TYPES ----------
interface SelectedMedia {
  id: string;
  uri: string;
  filename: string;
  mediaType: "photo" | "video";
  duration?: number;
  order: number;
}

type TabType = "gallery" | "poll";
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

const cleanHtml = (html: string) => {
  if (!html) return "";
  let text = html;
  text = text.replace(
    /<font\s+color=["']?((?:#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|[a-z]+))["']?>(.*?)<\/font>/gi,
    '<span style="color:$1">$2</span>'
  );
  text = text.replace(/^(<br\s*\/?>|&nbsp;|\s|<div>\s*<\/div>)+/, '');
  text = text.replace(/(<br\s*\/?>|&nbsp;|\s|<div>\s*<\/div>)+$/, '');
  return text.trim();
};

const stripHtml = (html: string) => {
  if (!html) return "";
  let text = html.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  return text.trim();
};

// ---------- COLOR PICKER COMPONENT ----------
const ColorPicker = ({ onSelect, type }: { onSelect: (color: string) => void; type: 'text' | 'background' }) => {
  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000',
    '#FFC0CB', '#A52A2A', '#808080', '#FFFFFF', '#2AABEE'
  ];

  return (
    <View style={styles.colorPickerContainer}>
      <Text style={styles.colorPickerTitle}>
        {type === 'text' ? 'Text Color' : 'Background Color'}
      </Text>
      <View style={styles.colorGrid}>
        {colors.map((color) => (
          <TouchableOpacity
            key={color}
            onPress={() => onSelect(color)}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              color === '#FFFFFF' && styles.whiteSwatchBorder
            ]}
          />
        ))}
      </View>
    </View>
  );
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
      <SafeAreaView style={styles.previewModalContainer}>
        {/* Header */}
        <View style={styles.previewModalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.previewCloseButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.previewHeaderCenter}>
            <Text style={styles.previewHeaderTitle}>
              {isVideo ? 'Video' : 'Photo'}
            </Text>
            {isVideo && asset.duration && (
              <Text style={styles.previewHeaderSubtitle}>
                {formatDuration(asset.duration)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onSelect}
            style={[
              styles.previewSelectButton,
              isSelected && styles.previewSelectButtonActive
            ]}
          >
            {isSelected ? (
              <View style={styles.previewSelectedBadge}>
                <Text style={styles.previewSelectedNumber}>{selectedOrder}</Text>
              </View>
            ) : (
              <Ionicons name="add-circle-outline" size={28} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.previewModalContent}>
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: asset.uri }}
              style={styles.previewVideo}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={visible}
              isLooping={false}
            />
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Bottom action */}
        <View style={styles.previewModalFooter}>
          <TouchableOpacity
            onPress={() => {
              onSelect();
              onClose();
            }}
            style={[
              styles.previewActionButton,
              isSelected && styles.previewActionButtonDeselect
            ]}
          >
            <Ionicons
              name={isSelected ? "checkmark-circle" : "add-circle"}
              size={24}
              color="#fff"
            />
            <Text style={styles.previewActionText}>
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

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

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
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: false,
        });
      }, 500);
    },
    []
  );

  const currentMedia = selectedMedia[currentIndex];

  const renderItem = useCallback(({ item }: { item: SelectedMedia }) => {
    const isVideo = item.mediaType === "video";

    return (
      <View style={styles.carouselItem}>
        {isVideo ? (
          <Video
            source={{ uri: item.uri }}
            style={styles.carouselVideo}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay={false}
          />
        ) : (
          <Image
            source={{ uri: item.uri }}
            style={styles.carouselImage}
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
      <SafeAreaView style={styles.carouselModalContainer}>
        {/* Header */}
        <View style={styles.carouselModalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.carouselCloseButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.carouselHeaderCenter}>
            <Text style={styles.carouselHeaderTitle}>
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
            style={styles.carouselDeleteButton}
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
          <View style={styles.carouselDots}>
            {selectedMedia.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.carouselDot,
                  index === currentIndex && styles.carouselDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
});

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
      style={styles.mediaItem}
      onPress={() => onPreview(item)}
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

      {/* Selection bubble - separate touch handler */}
      <TouchableOpacity
        style={[styles.selectionBubble, isSelected && styles.selectionBubbleSelected]}
        onPress={(e) => {
          e.stopPropagation();
          onSelect(item);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {isSelected && (
          <Text style={styles.selectionNumber}>{selectedOrder}</Text>
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
      style={styles.selectedThumb}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.selectedThumbImage}
        resizeMode="cover"
      />
      {isVideo && (
        <View style={styles.selectedThumbVideoIcon}>
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      )}
      <View style={styles.selectedThumbOrder}>
        <Text style={styles.selectedThumbOrderText}>{item.order}</Text>
      </View>
      <TouchableOpacity
        style={styles.selectedThumbRemove}
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
  const [inputHeight, setInputHeight] = useState(44);

  // Refs
  const richTextRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const heightUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const nextState = !showRichTextToolbar;
    const wasKeyboardVisible = isKeyboardVisible;

    setShowRichTextToolbar(nextState);

    if (nextState) {
      const htmlContent = caption ? caption.replace(/\n/g, '<br>') : '';
      const finalHtml = htmlContent ? `<div>${htmlContent}</div>` : '';

      setTimeout(() => {
        if (richTextRef.current) {
          richTextRef.current.setContentHTML(finalHtml);
          if (wasKeyboardVisible) {
            richTextRef.current.focusContentEditor();
          }
        }
      }, 100);
    } else {
      const plainText = stripHtml(caption);
      setCaption(plainText);

      setTimeout(() => {
        if (wasKeyboardVisible) {
          inputRef.current?.focus();
        }
      }, 100);
    }
  }, [showRichTextToolbar, caption, isKeyboardVisible]);

  const handleColorSelect = useCallback((color: string) => {
    if (showColorPicker === 'text') {
      richTextRef.current?.setForeColor(color);
    } else if (showColorPicker === 'background') {
      richTextRef.current?.setHiliteColor(color);
    }
    setShowColorPicker(null);
  }, [showColorPicker]);

  const toggleColorPicker = useCallback((type: 'text' | 'background') => {
    setShowColorPicker(prev => prev === type ? null : type);
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

      // Clean caption for rich text
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
  const handleCameraSend = useCallback(async (uri: string, mediaType: 'photo' | 'video', duration?: number, cameraCaption?: string) => {
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

  const keyExtractor = useCallback((item: GalleryItem, index: number) =>
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

  const isEmpty = useMemo(() => {
    if (showRichTextToolbar) {
      return stripHtml(caption).length === 0;
    }
    return caption.trim().length === 0;
  }, [caption, showRichTextToolbar]);

  const maxInputHeight = 120;

  // Render selected media thumbnails bar
  const renderSelectedMediaBar = () => (
    <View style={styles.selectedMediaBar}>
      <FlatList
        data={selectedMedia}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.selectedMediaList}
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

  // Render rich text input bar
  const renderInputBar = () => (
    <View style={styles.inputBar}>
      {/* Selected media thumbnails */}
      {renderSelectedMediaBar()}

      {/* Input row */}
      <View style={styles.inputRow}>
        {/* Format toggle button */}
        {Platform.OS !== 'web' && RichEditor && (
          <TouchableOpacity
            onPress={handleToggleRichText}
            style={[
              styles.formatButton,
              showRichTextToolbar && styles.formatButtonActive
            ]}
          >
            <Ionicons
              name="text"
              size={20}
              color={showRichTextToolbar ? '#2AABEE' : '#666666'}
            />
          </TouchableOpacity>
        )}

        {/* Input container */}
        <View style={styles.inputContainer}>
          {showRichTextToolbar && Platform.OS !== 'web' && RichEditor ? (
            <View style={{ minHeight: 44, maxHeight: maxInputHeight }}>
              <RichEditor
                ref={richTextRef}
                onChange={setCaption}
                placeholder="Add a caption..."
                initialContentHTML={caption}
                initialHeight={44}
                androidHardwareAccelerationDisabled={true}
                androidLayerType="software"
                editorStyle={{
                  backgroundColor: "#f9fafb",
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
                  backgroundColor: '#f9fafb',
                  minHeight: 44,
                  maxHeight: maxInputHeight,
                }}
              />
            </View>
          ) : (
            <TextInput
              ref={inputRef}
              style={[styles.captionInput, { height: inputHeight, maxHeight: maxInputHeight }]}
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
          style={[styles.sendButton, (isSending || selectedMedia.length === 0) && styles.sendButtonDisabled]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Rich text toolbar */}
      {showRichTextToolbar && isKeyboardVisible && Platform.OS !== 'web' && RichToolbar && (
        <View style={styles.formatToolbar}>
          <RichToolbar
            editor={richTextRef}
            selectedIconTint="#2AABEE"
            iconTint="#666"
            actions={[
              actions.setBold,
              actions.setItalic,
              actions.setUnderline,
              actions.setStrikethrough,
              'textColor',
              'backgroundColor',
            ]}
            iconMap={{
              [actions.setBold]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Text style={[styles.textIconLabel, { color: tintColor }]}>B</Text>
                </View>
              ),
              [actions.setItalic]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Text style={[styles.textIconLabel, { fontStyle: 'italic', color: tintColor }]}>I</Text>
                </View>
              ),
              [actions.setUnderline]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Text style={[styles.textIconLabel, { textDecorationLine: 'underline', color: tintColor }]}>U</Text>
                </View>
              ),
              [actions.setStrikethrough]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Text style={[styles.textIconLabel, { textDecorationLine: 'line-through', color: tintColor }]}>S</Text>
                </View>
              ),
              textColor: ({ tintColor }: any) => (
                <TouchableOpacity onPress={() => toggleColorPicker('text')} style={styles.simpleToolIcon}>
                  <Ionicons name="color-palette" size={22} color={tintColor} />
                </TouchableOpacity>
              ),
              backgroundColor: ({ tintColor }: any) => (
                <TouchableOpacity onPress={() => toggleColorPicker('background')} style={styles.simpleToolIcon}>
                  <Ionicons name="color-fill" size={22} color={tintColor} />
                </TouchableOpacity>
              ),
            }}
            style={styles.richToolbar}
            flatContainerStyle={styles.flatToolbarContainer}
          />
        </View>
      )}
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

      {/* Color Picker Modal */}
      {showColorPicker && (
        <Modal transparent visible={!!showColorPicker} onRequestClose={() => setShowColorPicker(null)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowColorPicker(null)}
          >
            <View style={styles.colorPickerModal}>
              <ColorPicker
                type={showColorPicker}
                onSelect={handleColorSelect}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'none',
  },
  tabLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
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
    paddingBottom: 8,
  },
  // Selected media bar
  selectedMediaBar: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#f9fafb",
  },
  selectedMediaList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  selectedThumb: {
    width: SELECTED_THUMB_SIZE,
    height: SELECTED_THUMB_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  selectedThumbImage: {
    width: '100%',
    height: '100%',
  },
  selectedThumbVideoIcon: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedThumbOrder: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#2AABEE',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedThumbOrderText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedThumbRemove: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
  },
  formatButton: {
    width: 40,
    height: 44,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  formatButtonActive: {
    backgroundColor: '#E0F2FE',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    minHeight: 44,
  },
  captionInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 44,
    textAlignVertical: 'center',
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
  // Format toolbar
  formatToolbar: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
  },
  richToolbar: {
    backgroundColor: '#F9FAFB',
    height: 44,
  },
  flatToolbarContainer: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  simpleToolIcon: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textIconLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Gallery grid
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  selectionBubbleSelected: {
    backgroundColor: "#2AABEE",
    borderColor: "#2AABEE",
  },
  selectionNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
  // Preview modal
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  previewCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  previewHeaderTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  previewHeaderSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  previewSelectButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewSelectButtonActive: {},
  previewSelectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2AABEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewSelectedNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  previewModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 200,
  },
  previewVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 200,
  },
  previewModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  previewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2AABEE',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  previewActionButtonDeselect: {
    backgroundColor: '#ef4444',
  },
  previewActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Carousel modal
  carouselModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  carouselModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  carouselCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  carouselHeaderTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  carouselDeleteButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  carouselVideo: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  carouselDotActive: {
    backgroundColor: '#2AABEE',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Color picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  colorPickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 320,
  },
  colorPickerContainer: {
    padding: 4,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  whiteSwatchBorder: {
    borderColor: '#E5E7EB',
  },
});