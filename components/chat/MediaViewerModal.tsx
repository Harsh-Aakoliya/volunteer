// components/chat/MediaViewerModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
  BackHandler,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { getApiUrl } from "@/stores/apiStore";
import { getMediaFiles } from "@/api/chat/media";
import { Video, ResizeMode } from "expo-av";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.4 };
const ZOOM_SPRING = { damping: 35, stiffness: 300, mass: 0.5 };
const SWIPE_DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_VELOCITY_THRESHOLD = 600;
const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;

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

// ─── Video Thumbnail Cell ─────────────────────────────────────────────────────
const VideoThumbnail: React.FC<{
  file: MediaFile;
  width: number;
  height: number;
}> = ({ file, width, height }) => {
  const uri = `${getApiUrl()}/media/chat/${file.filename}`;
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
      <View
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center", alignItems: "center",
            borderWidth: 2, borderColor: "rgba(255,255,255,0.8)",
          }}
        >
          <Ionicons name="play" size={26} color="white" style={{ marginLeft: 3 }} />
        </View>
      </View>
    </View>
  );
};

// ─── Video Player ─────────────────────────────────────────────────────────────
interface VideoPlayerCompProps {
  file: MediaFile;
  isActive: boolean;
}

const VideoPlayerComp: React.FC<VideoPlayerCompProps> = ({ file, isActive }) => {
  const videoUrl = `${getApiUrl()}/media/chat/${file.url}`;
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

// ─── Zoomable Image Slide ─────────────────────────────────────────────────────
// Handles: pinch zoom, double-tap zoom, pan-when-zoomed, and carousel swipe
// when not zoomed — all without conflict.
interface ZoomableImageSlideProps {
  uri: string;
  containerHeight: number;
  isActive: boolean;
  index: number;
  totalCount: number;
  currentIndexSV: Animated.SharedValue<number>;
  carouselOffsetSV: Animated.SharedValue<number>;
  onIndexChange: (index: number) => void;
}

const ZoomableImageSlide: React.FC<ZoomableImageSlideProps> = ({
  uri,
  containerHeight,
  isActive,
  index,
  totalCount,
  currentIndexSV,
  carouselOffsetSV,
  onIndexChange,
}) => {
  // Image transform state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const imgTransX = useSharedValue(0);
  const imgTransY = useSharedValue(0);
  const savedImgTransX = useSharedValue(0);
  const savedImgTransY = useSharedValue(0);
  // Shared value mirror of `isActive` prop so worklets can read it
  const isActiveSV = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    isActiveSV.value = isActive ? 1 : 0;
    // Reset zoom when slide scrolls off screen
    if (!isActive) {
      scale.value = withTiming(1, { duration: 200 });
      imgTransX.value = withTiming(0, { duration: 200 });
      imgTransY.value = withTiming(0, { duration: 200 });
      savedScale.value = 1;
      savedImgTransX.value = 0;
      savedImgTransY.value = 0;
    }
  }, [isActive]);

  // ── Helpers (run on UI thread) ───────────────────────────────────────────
  const clampedX = (tx: number, s: number) => {
    "worklet";
    const max = (SCREEN_WIDTH * (s - 1)) / 2;
    return Math.max(-max, Math.min(tx, max));
  };

  const clampedY = (ty: number, s: number) => {
    "worklet";
    const max = (containerHeight * (s - 1)) / 2;
    return Math.max(-max, Math.min(ty, max));
  };

  const resetZoom = () => {
    "worklet";
    scale.value = withSpring(1, ZOOM_SPRING);
    imgTransX.value = withSpring(0, ZOOM_SPRING);
    imgTransY.value = withSpring(0, ZOOM_SPRING);
    savedScale.value = 1;
    savedImgTransX.value = 0;
    savedImgTransY.value = 0;
  };

  const snapCarousel = (targetIndex: number, currentIdx: number) => {
    "worklet";
    currentIndexSV.value = targetIndex;
    carouselOffsetSV.value = withSpring(-targetIndex * SCREEN_WIDTH, SPRING_CONFIG);
    if (targetIndex !== currentIdx) {
      runOnJS(onIndexChange)(targetIndex);
    }
  };

  // ── Pinch gesture ────────────────────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      if (isActiveSV.value === 0) return;
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, MAX_ZOOM));
    })
    .onEnd(() => {
      if (isActiveSV.value === 0) return;
      if (scale.value < 1.08) {
        resetZoom();
      } else {
        savedScale.value = scale.value;
        const cx = clampedX(imgTransX.value, scale.value);
        const cy = clampedY(imgTransY.value, scale.value);
        imgTransX.value = withSpring(cx, ZOOM_SPRING);
        imgTransY.value = withSpring(cy, ZOOM_SPRING);
        savedImgTransX.value = cx;
        savedImgTransY.value = cy;
      }
    });

  // ── Pan gesture ──────────────────────────────────────────────────────────
  // maxPointers(1): only single-finger pan — prevents 2-finger pinch from
  //   also triggering the carousel drag path when scale=1.
  // minDistance(10): small threshold so the gesture doesn't fire accidentally.
  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(10)
    .onUpdate((e) => {
      if (isActiveSV.value === 0) return;

      if (scale.value > 1) {
        imgTransX.value = clampedX(savedImgTransX.value + e.translationX, scale.value);
        imgTransY.value = clampedY(savedImgTransY.value + e.translationY, scale.value);
      } else {
        const baseOffset = -currentIndexSV.value * SCREEN_WIDTH;
        let tx = e.translationX;
        const wouldBe = baseOffset + tx;
        const minOffset = -(totalCount - 1) * SCREEN_WIDTH;
        if (wouldBe > 0 || wouldBe < minOffset) {
          tx *= 0.25;
        }
        carouselOffsetSV.value = baseOffset + tx;
      }
    })
    .onEnd((e) => {
      if (isActiveSV.value === 0) return;

      if (scale.value > 1) {
        savedImgTransX.value = imgTransX.value;
        savedImgTransY.value = imgTransY.value;
      } else {
        const currentIdx = currentIndexSV.value;
        let targetIndex = currentIdx;

        const movedLeft =
          e.translationX < -SWIPE_DISTANCE_THRESHOLD ||
          e.velocityX < -SWIPE_VELOCITY_THRESHOLD;
        const movedRight =
          e.translationX > SWIPE_DISTANCE_THRESHOLD ||
          e.velocityX > SWIPE_VELOCITY_THRESHOLD;

        if (movedLeft && currentIdx < totalCount - 1) {
          targetIndex = currentIdx + 1;
        } else if (movedRight && currentIdx > 0) {
          targetIndex = currentIdx - 1;
        }

        snapCarousel(targetIndex, currentIdx);
      }
    });

  // ── Double-tap gesture ───────────────────────────────────────────────────
  // First tap  → zoom in to DOUBLE_TAP_ZOOM centred on tap position
  // Second tap → zoom back out to 1x
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((e, success) => {
      if (!success || isActiveSV.value === 0) return;

      if (scale.value > 1) {
        resetZoom();
      } else {
        const ts = DOUBLE_TAP_ZOOM;
        // Offset of tap from image centre
        const tapX = e.x - SCREEN_WIDTH / 2;
        const tapY = e.y - containerHeight / 2;
        // Translate so the tapped point stays centred
        const newTX = clampedX(-tapX * (ts - 1), ts);
        const newTY = clampedY(-tapY * (ts - 1), ts);

        scale.value = withSpring(ts, ZOOM_SPRING);
        imgTransX.value = withSpring(newTX, ZOOM_SPRING);
        imgTransY.value = withSpring(newTY, ZOOM_SPRING);
        savedScale.value = ts;
        savedImgTransX.value = newTX;
        savedImgTransY.value = newTY;
      }
    });

  // Run all three simultaneously so pinch + pan can happen together (e.g.
  // pinch-and-pan while zoomed). The double-tap fires quickly and won't
  // conflict with the slower pan activation.
  const composedGesture = Gesture.Simultaneous(
    doubleTapGesture,
    pinchGesture,
    panGesture,
  );

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: imgTransX.value },
      { translateY: imgTransY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <View
        style={{
          width: SCREEN_WIDTH,
          height: containerHeight,
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <Animated.Image
          source={{ uri }}
          style={[{ width: SCREEN_WIDTH, height: containerHeight }, imageAnimStyle]}
          resizeMode="contain"
        />
      </View>
    </GestureDetector>
  );
};

// ─── Swipeable Slide (non-image wrapper) ──────────────────────────────────────
// Wraps video / audio / document slides with carousel swipe support.
interface SwipeableSlideProps {
  children: React.ReactNode;
  isActive: boolean;
  index: number;
  totalCount: number;
  currentIndexSV: Animated.SharedValue<number>;
  carouselOffsetSV: Animated.SharedValue<number>;
  onIndexChange: (index: number) => void;
}

const SwipeableSlide: React.FC<SwipeableSlideProps> = ({
  children,
  isActive,
  index,
  totalCount,
  currentIndexSV,
  carouselOffsetSV,
  onIndexChange,
}) => {
  const isActiveSV = useSharedValue(isActive ? 1 : 0);
  useEffect(() => {
    isActiveSV.value = isActive ? 1 : 0;
  }, [isActive]);

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(10)
    .onUpdate((e) => {
      if (isActiveSV.value === 0) return;
      const baseOffset = -currentIndexSV.value * SCREEN_WIDTH;
      let tx = e.translationX;
      const wouldBe = baseOffset + tx;
      const minOffset = -(totalCount - 1) * SCREEN_WIDTH;
      if (wouldBe > 0 || wouldBe < minOffset) tx *= 0.25;
      carouselOffsetSV.value = baseOffset + tx;
    })
    .onEnd((e) => {
      if (isActiveSV.value === 0) return;
      const currentIdx = currentIndexSV.value;
      let targetIndex = currentIdx;

      const movedLeft =
        e.translationX < -SWIPE_DISTANCE_THRESHOLD ||
        e.velocityX < -SWIPE_VELOCITY_THRESHOLD;
      const movedRight =
        e.translationX > SWIPE_DISTANCE_THRESHOLD ||
        e.velocityX > SWIPE_VELOCITY_THRESHOLD;

      if (movedLeft && currentIdx < totalCount - 1) targetIndex = currentIdx + 1;
      else if (movedRight && currentIdx > 0) targetIndex = currentIdx - 1;

      currentIndexSV.value = targetIndex;
      carouselOffsetSV.value = withSpring(-targetIndex * SCREEN_WIDTH, SPRING_CONFIG);
      if (targetIndex !== currentIdx) runOnJS(onIndexChange)(targetIndex);
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ width: SCREEN_WIDTH }}>{children}</View>
    </GestureDetector>
  );
};

// ─── Gallery Item ─────────────────────────────────────────────────────────────
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
    const mediaUrl = `${getApiUrl()}/media/chat/${item.url}`;
    const [imageHeight, setImageHeight] = useState<number | null>(null);

    useEffect(() => {
      if (isImage) {
        Image.getSize(
          mediaUrl,
          (w, h) => {
            const aspectRatio = h / w;
            const calculated = SCREEN_WIDTH * aspectRatio;
            setImageHeight(Math.min(Math.max(calculated, 100), SCREEN_HEIGHT * 0.85));
          },
          () => setImageHeight(SCREEN_WIDTH * 0.6),
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
  },
);

// ─── Gallery View ─────────────────────────────────────────────────────────────
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
}) => (
  <View className="flex-1 bg-white">
    <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-white border-b border-neutral-200">
      <TouchableOpacity onPress={onClose}>
        <Ionicons name="close" size={28} color="black" />
      </TouchableOpacity>
      <Text className="text-black text-lg font-semibold">
        Media
        {files.length > 0
          ? `: ${files.length} file${files.length !== 1 ? "s" : ""}`
          : ""}
      </Text>
      <View style={{ width: 28 }} />
    </View>

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
        {files.map((item, i) => (
          <React.Fragment key={`gal-${i}-${item.url}`}>
            <View className="flex-1">
              <GalleryItem item={item} index={i} onPress={onMediaPress} />
              {i < files.length - 1 && <View className="h-0.5 bg-neutral-900" />}
            </View>
            <View className="h-1.5 bg-neutral-900" />
          </React.Fragment>
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

// ─── Full-screen Carousel Viewer ──────────────────────────────────────────────
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

  // Shared values for the carousel — readable on the UI thread inside gesture worklets
  const carouselOffsetSV = useSharedValue(-initialIndex * SCREEN_WIDTH);
  const currentIndexSV = useSharedValue(initialIndex);

  const containerHeight = SCREEN_HEIGHT - 120;
  const isSingleFile = files.length === 1;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const handleIndexChange = useCallback((newIndex: number) => {
    setCurrentIndex(newIndex);
  }, []);

  const carouselAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: carouselOffsetSV.value }],
  }));

  const currentFile = files[currentIndex];

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* ── Header ── */}
      
      <View
        // style={{
        //   flexDirection: "row",
        //   alignItems: "center",
        //   justifyContent: "space-between",
        //   paddingHorizontal: 16,
        //   paddingTop: 50,
        //   paddingBottom: 12,
        //   backgroundColor: "#fff",
        //   borderBottomWidth: 1,
        //   borderBottomColor: "#e5e5e5",
        // }}
        
        className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-white border-b border-neutral-200"
      >
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="close" size={28} color="black" />
        </TouchableOpacity>
        <Text
          style={{ fontSize: 18, fontWeight: "600", color: "#000", flex: 1, textAlign: "center" }}
          numberOfLines={1}
        >
          {isSingleFile
            ? currentFile?.originalName || "Media"
            : `${currentIndex + 1} / ${files.length}`}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* ── Carousel ── */}
      {/* overflow:'hidden' ensures only the current slide's area is touchable */}
      <View style={{ flex: 1, overflow: "hidden" }}>
        <Animated.View
          style={[
            {
              flexDirection: "row",
              width: SCREEN_WIDTH * files.length,
              height: containerHeight,
            },
            carouselAnimStyle,
          ]}
        >
          {files.map((file, idx) => {
            const isImage = file.mimeType?.startsWith("image/");
            const isVideo = file.mimeType?.startsWith("video/");
            const isAudio = file.mimeType?.startsWith("audio/");
            const mediaUrl = `${getApiUrl()}/media/chat/${file.url}`;
            const isActive = idx === currentIndex;

            // ── Image slide ──
            if (isImage) {
              return (
                <ZoomableImageSlide
                  key={`slide-${idx}`}
                  uri={mediaUrl}
                  containerHeight={containerHeight}
                  isActive={isActive}
                  index={idx}
                  totalCount={files.length}
                  currentIndexSV={currentIndexSV}
                  carouselOffsetSV={carouselOffsetSV}
                  onIndexChange={handleIndexChange}
                />
              );
            }

            // ── Video / Audio / Document slides ──
            return (
              <SwipeableSlide
                key={`slide-${idx}`}
                isActive={isActive}
                index={idx}
                totalCount={files.length}
                currentIndexSV={currentIndexSV}
                carouselOffsetSV={carouselOffsetSV}
                onIndexChange={handleIndexChange}
              >
                <View
                  style={{
                    width: SCREEN_WIDTH,
                    height: containerHeight,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#000",
                  }}
                >
                  {isVideo && <VideoPlayerComp file={file} isActive={isActive} />}

                  {isAudio && (
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 20,
                      }}
                    >
                      <View
                        style={{
                          width: 176,
                          height: 176,
                          backgroundColor: "#7c3aed",
                          borderRadius: 88,
                          justifyContent: "center",
                          alignItems: "center",
                          marginBottom: 24,
                        }}
                      >
                        <Ionicons name="musical-notes" size={72} color="white" />
                      </View>
                      <Text
                        style={{
                          color: "white",
                          fontSize: 18,
                          fontWeight: "600",
                          textAlign: "center",
                        }}
                      >
                        {file.originalName}
                      </Text>
                      <Text style={{ color: "#6b7280", fontSize: 14, marginTop: 8 }}>
                        Audio File
                      </Text>
                    </View>
                  )}

                  {!isVideo && !isAudio && (
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 20,
                      }}
                    >
                      <Ionicons name="document-outline" size={56} color="#666" />
                      <Text
                        style={{
                          color: "white",
                          fontSize: 16,
                          fontWeight: "500",
                          textAlign: "center",
                          marginTop: 16,
                        }}
                      >
                        {file.originalName}
                      </Text>
                      <Text
                        style={{
                          color: "#6b7280",
                          fontSize: 14,
                          marginTop: 8,
                          textAlign: "center",
                        }}
                      >
                        {file.mimeType}
                      </Text>
                    </View>
                  )}
                </View>
              </SwipeableSlide>
            );
          })}
        </Animated.View>
      </View>

      {/* ── Pagination dots / counter ── */}
      {!isSingleFile && (
        <View
          style={{
            position: "absolute",
            bottom: 32,
            left: 0,
            right: 0,
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          {files.length <= 15 ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
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
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.7)",
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 20,
              }}
            >
              <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }}>
                {currentIndex + 1} of {files.length}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
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

  const isSingleFile = (mediaData?.files?.length ?? 0) === 1;

  const applyMediaData = useCallback(
    (files: MediaFile[], startIndex: number) => {
      const data: MediaData = {
        id: 0, roomId: 0, senderId: "",
        createdAt: "", messageId: 0,
        files,
      };
      setMediaData(data);
      setError(null);
      setLoading(false);

      if (files.length === 1) {
        setViewMode("fullscreen");
        setSelectedIndex(0);
      } else {
        setViewMode("gallery");
        setSelectedIndex(startIndex);
      }
    },
    [],
  );

  useEffect(() => {
    if (visible) {
      if (mediaFiles && mediaFiles.length > 0) {
        const formattedFiles: MediaFile[] = mediaFiles.map((file) => ({
          url: file.fileName || file.id,
          filename: file.fileName,
          originalName: file.originalName || file.fileName,
          caption: "",
          mimeType: file.mimeType,
          size: file.size || 0,
        }));
        applyMediaData(formattedFiles, initialIndex);
      } else if (mediaId) {
        setViewMode("gallery");
        setSelectedIndex(initialIndex);
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
      if (viewMode === "fullscreen" && !isSingleFile) {
        setViewMode("gallery");
        return true;
      }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, viewMode, onClose, isSingleFile]);

  const fetchMediaData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMediaFiles(mediaId!);
      if (data.success) {
        applyMediaData(data.media.files, initialIndex);
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
    if (isSingleFile) {
      onClose();
    } else {
      setViewMode("gallery");
    }
  }, [isSingleFile, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (viewMode === "fullscreen" && !isSingleFile) {
          handleBackToGallery();
        } else {
          onClose();
        }
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    </Modal>
  );
}