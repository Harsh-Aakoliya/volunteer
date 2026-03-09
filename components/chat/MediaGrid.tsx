import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Video, ResizeMode } from 'expo-av';
import { API_URL } from '@/constants/api';
import { getMediaFiles } from "@/api/chat/media";
import AudioMessagePlayer from '@/components/chat/AudioMessagePlayer';

interface MediaFile {
  id: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface MediaGridProps {
  mediaFilesId: number;
  messageId: string | number;
  onMediaPress: (mediaFiles: MediaFile[], selectedIndex: number) => void;
  isOwnMessage: boolean;
  isLoading?: boolean;
}

// Cache for media files and dimensions
const mediaCache: Map<number, MediaFile[]> = new Map();
const dimensionsCache: Map<string, { w: number; h: number }> = new Map();

const BORDER_RADIUS = 8;
const GAP = 4;

const getImageUri = (fileName: string) => `${API_URL}/media/chat/${fileName}`;

const clampAspect = (d: { w: number; h: number }) => {
  if (!d || d.w <= 0 || d.h <= 0) return 1;
  return Math.min(Math.max(d.w / d.h, 0.6), 2.0);
};

const MediaGrid: React.FC<MediaGridProps> = ({
  mediaFilesId,
  onMediaPress,
  isOwnMessage,
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dimensions, setDimensions] = useState<Record<number, { w: number; h: number }>>({});

  // ----------------------------------------------------
  // DYNAMIC SIZING CALCULATIONS
  // ----------------------------------------------------
  const { width: screenWidth } = useWindowDimensions();
  
  // Exactly calculate the maximum internal space of the bubble to prevent ANY overflow.
  const SAFE_SCREEN_WIDTH = screenWidth - 12; // Accounts for outer wrapper padding
  const bubbleMaxWidth = isOwnMessage ? SAFE_SCREEN_WIDTH * 0.85 : SAFE_SCREEN_WIDTH * 0.78;
  const MAX_BUBBLE_WIDTH = bubbleMaxWidth - 16; // Accounts for internal bubble padding
  
  const MAX_SINGLE_HEIGHT = MAX_BUBBLE_WIDTH * 1.4;

  const fitInBox = useCallback((imgW: number, imgH: number): { w: number; h: number } => {
    if (imgW <= 0 || imgH <= 0) return { w: MAX_BUBBLE_WIDTH, h: MAX_BUBBLE_WIDTH };
    const aspect = imgH / imgW;
    const maxAspect = MAX_SINGLE_HEIGHT / MAX_BUBBLE_WIDTH;
    if (aspect >= maxAspect) {
      const h = MAX_SINGLE_HEIGHT;
      return { w: h / aspect, h };
    }
    const w = MAX_BUBBLE_WIDTH;
    return { w, h: w * aspect };
  }, [MAX_BUBBLE_WIDTH, MAX_SINGLE_HEIGHT]);

  const fetchDimensions = useCallback((files: MediaFile[]) => {
    files.forEach((file, index) => {
      const isImage = file.mimeType.startsWith('image');
      const isVideo = file.mimeType.startsWith('video');

      if (isImage) {
        const uri = getImageUri(file.fileName);
        const cached = dimensionsCache.get(uri);
        if (cached) {
          setDimensions((prev) => ({ ...prev, [index]: cached }));
        } else {
          Image.getSize(
            uri,
            (w, h) => {
              const d = { w, h };
              dimensionsCache.set(uri, d);
              setDimensions((prev) => ({ ...prev, [index]: d }));
            },
            () => { /* onLoad provides fallback */ }
          );
        }
      } else if (isVideo) {
        setDimensions((prev) => ({ ...prev, [index]: { w: 16, h: 9 } }));
      }
    });
  }, []);

  const onImageDimensions = useCallback((index: number, w: number, h: number) => {
    const uri = getImageUri(mediaFiles[index]?.fileName || '');
    const d = { w, h };
    dimensionsCache.set(uri, d);
    setDimensions((prev) => ({ ...prev, [index]: d }));
  }, [mediaFiles]);

  useEffect(() => {
    if (!mediaFilesId) {
      setMediaFiles([]);
      setLoading(false);
      setError(false);
      setDimensions({});
      return;
    }

    const cached = mediaCache.get(mediaFilesId);
    if (cached) {
      setMediaFiles(cached);
      setLoading(false);
      setError(false);
      fetchDimensions(cached);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(false);
        const data = await getMediaFiles(mediaFilesId);
        if (data.success && data.media?.files) {
          const files: MediaFile[] = data.media.files.map((f: any) => ({
            id: f.id || Math.random(),
            fileName: f.url || f.filename,
            originalName: f.originalName || f.filename,
            mimeType: f.mimeType,
            size: f.size || 0,
          }));
          setMediaFiles(files);
          mediaCache.set(mediaFilesId, files);
          fetchDimensions(files);
        } else {
          setMediaFiles([]);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mediaFilesId, fetchDimensions]);

  const getDim = (index: number) => {
    const d = dimensions[index];
    const f = mediaFiles[index];
    if (d) return d;
    if (f?.mimeType.startsWith('video')) return { w: 16, h: 9 };
    return { w: 1, h: 1 };
  };

  const handleVideoReadyInCell = useCallback(
    (index: number, uri: string) => (e: { naturalSize?: { width: number; height: number } }) => {
      const naturalSize = e?.naturalSize;
      if (naturalSize?.width && naturalSize?.height) {
        const d = { w: naturalSize.width, h: naturalSize.height };
        dimensionsCache.set(uri, d);
        onImageDimensions(index, naturalSize.width, naturalSize.height);
      }
    },
    [onImageDimensions]
  );

  // Core renderer updated to support percentage & Flexbox styling
  const renderFlexCell = (
    file: MediaFile,
    index: number,
    styleProps: any,
    resizeMode: 'cover' | 'contain' = 'cover'
  ) => {
    if (!file) return null;
    const isImage = file.mimeType.startsWith('image');
    const isVideo = file.mimeType.startsWith('video');
    const isAudio = file.mimeType.startsWith('audio');
    const uri = getImageUri(file.fileName);

    return (
      <TouchableOpacity
        key={file.id}
        onPress={() => onMediaPress(mediaFiles, index)}
        style={[styles.cell, styleProps, { borderRadius: BORDER_RADIUS }]}
        activeOpacity={0.9}
      >
        {isImage && (
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode={resizeMode} />
        )}
        {isVideo && (
          <Video
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={resizeMode === 'cover' ? ResizeMode.COVER : ResizeMode.CONTAIN}
            shouldPlay={false}
            isMuted
            isLooping={false}
            useNativeControls={false}
            onReadyForDisplay={handleVideoReadyInCell(index, uri)}
          />
        )}
        {isAudio && (
          <View style={[styles.audioCell, { width: '100%', height: '100%' }]}>
            <View style={styles.audioIcon}>
              <Ionicons name="musical-notes" size={32} color="white" />
            </View>
          </View>
        )}
        {isVideo && (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={25} color="white" />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.placeholder, { width: '100%', minWidth: 200, maxWidth: MAX_BUBBLE_WIDTH, height: 140 }]}>
        <ActivityIndicator size="small" color="#6b7280" />
        <Text style={styles.placeholderText}>Loading media...</Text>
      </View>
    );
  }

  if (error || mediaFiles.length === 0) {
    return (
      <View style={[styles.placeholder, styles.emptyPlaceholder, { width: '100%', minWidth: 200, maxWidth: MAX_BUBBLE_WIDTH, height: 140 }]}>
        <Ionicons name="image-outline" size={32} color="#9ca3af" />
        <Text style={styles.placeholderText}>No media files</Text>
      </View>
    );
  }

  const count = mediaFiles.length;
  const single = mediaFiles[0];

  if (count === 1 && single.mimeType.startsWith('audio')) {
    return (
      <AudioMessagePlayer
        audioUrl={getImageUri(single.fileName)}
        isOwnMessage={isOwnMessage}
      />
    );
  }

  // ----------------------------------------------------
  // SINGLE MEDIA: Perfect scaling
  // ----------------------------------------------------
  if (count === 1) {
    const dim = getDim(0);
    const { w, h } = fitInBox(dim.w, dim.h);
    const safeMinWidth = Math.min(w, MAX_BUBBLE_WIDTH); // Ensure minWidth never breaks bounds

    return (
      <View style={styles.singleWrapper}>
        <SingleMediaDisplay
          file={single}
          index={0}
          displayWidth={safeMinWidth}
          aspectRatio={w / h}
          maxWidth={MAX_BUBBLE_WIDTH}
          mediaFiles={mediaFiles}
          onMediaPress={onMediaPress}
          onImageDimensions={onImageDimensions}
        />
      </View>
    );
  }

  // Helper to abstract the +N overlay logic
  const cell = (idx: number, styleProps: any, remaining?: number) => {
    if (idx === 2 && remaining != null && remaining > 0) {
      return (
        <View style={[styleProps, { position: 'relative' }]}>
          {renderFlexCell(mediaFiles[idx], idx, { ...StyleSheet.absoluteFillObject })}
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, styles.plusOverlay]}
            onPress={() => onMediaPress(mediaFiles, 3)}
            activeOpacity={1}
          >
            <Text style={styles.plusText}>+{remaining}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return renderFlexCell(mediaFiles[idx], idx, styleProps);
  };

  // ----------------------------------------------------
  // 2 MEDIA FILES
  // ----------------------------------------------------
  if (count === 2) {
    const aspect0 = getDim(0).w / getDim(0).h;
    const aspect1 = getDim(1).w / getDim(1).h;
    const bothPortrait = aspect0 <= 1 && aspect1 <= 1;

    // Both Portrait -> Side by Side
    if (bothPortrait) {
      return (
        <View style={[{ width: '100%', minWidth: 200, maxWidth: MAX_BUBBLE_WIDTH, flexDirection: 'row', gap: GAP }, styles.wrapper]}>
          {cell(0, { flex: 1, aspectRatio: 3/4 })}
          {cell(1, { flex: 1, aspectRatio: 3/4 })}
        </View>
      );
    }

    // Stacked
    return (
      <View style={[{ width: '100%', minWidth: 200, maxWidth: MAX_BUBBLE_WIDTH, gap: GAP }, styles.wrapper]}>
        {cell(0, { width: '100%', aspectRatio: clampAspect(getDim(0)) })}
        {cell(1, { width: '100%', aspectRatio: clampAspect(getDim(1)) })}
      </View>
    );
  }

  // ----------------------------------------------------
  // 3 OR 4+ MEDIA FILES
  // ----------------------------------------------------
  if (count >= 3) {
    const remaining = count >= 4 ? count - 3 : 0;
    const p0 = getDim(0).w / getDim(0).h <= 1;
    const p1 = getDim(1).w / getDim(1).h <= 1;
    const p2 = getDim(2).w / getDim(2).h <= 1;
    const orientations = [p0, p1, p2];
    const portraitCount = orientations.filter(Boolean).length;

    // 1 Left, 2 Right (PPP)
    if (p0 && p1 && p2) {
      return (
        <View style={[{ width: '100%', minWidth: 240, maxWidth: MAX_BUBBLE_WIDTH, flexDirection: 'row', gap: GAP, aspectRatio: 1.2 }, styles.wrapper]}>
          {cell(0, { flex: 1 })}
          <View style={{ flex: 1, gap: GAP }}>
            {cell(1, { flex: 1 })}
            {cell(2, { flex: 1 }, remaining)}
          </View>
        </View>
      );
    }

    // 2 Top, 1 Bottom (PPL, PLP, LPP)
    if (portraitCount === 2) {
      const portraitIndices = [0, 1, 2].filter((i) => orientations[i]);
      const landscapeIndex = [0, 1, 2].find((i) => !orientations[i])!;
      return (
        <View style={[{ width: '100%', minWidth: 240, maxWidth: MAX_BUBBLE_WIDTH, gap: GAP, aspectRatio: 1 }, styles.wrapper]}>
          <View style={{ flex: 1, flexDirection: 'row', gap: GAP }}>
            {cell(portraitIndices[0], { flex: 1 })}
            {cell(portraitIndices[1], { flex: 1 })}
          </View>
          {cell(landscapeIndex, { flex: 1 }, landscapeIndex === 2 ? remaining : 0)}
        </View>
      );
    }

    // All Stacked (PLL, LPL, LLP, LLL)
    return (
      <View style={[{ width: '100%', minWidth: 240, maxWidth: MAX_BUBBLE_WIDTH, gap: GAP }, styles.wrapper]}>
        {cell(0, { width: '100%', aspectRatio: clampAspect(getDim(0)) })}
        {cell(1, { width: '100%', aspectRatio: clampAspect(getDim(1)) })}
        {cell(2, { width: '100%', aspectRatio: clampAspect(getDim(2)) }, remaining)}
      </View>
    );
  }

  return null;
};

// ==========================================
// SINGLE MEDIA DISPLAY (Responsive Sizing)
// ==========================================
const SingleMediaDisplay: React.FC<{
  file: MediaFile;
  index: number;
  displayWidth: number;
  aspectRatio: number;
  maxWidth: number;
  mediaFiles: MediaFile[];
  onMediaPress: (files: MediaFile[], idx: number) => void;
  onImageDimensions: (index: number, w: number, h: number) => void;
}> = ({ file, index, displayWidth, aspectRatio, maxWidth, mediaFiles, onMediaPress, onImageDimensions }) => {
  const isImage = file.mimeType.startsWith('image');
  const isVideo = file.mimeType.startsWith('video');
  const uri = getImageUri(file.fileName);

  const handleImageLoad = (e: any) => {
    const source = e?.nativeEvent?.source;
    if (source?.width && source?.height) {
      onImageDimensions(index, source.width, source.height);
    }
  };

  const handleVideoReadyForDisplay = (e: { naturalSize?: { width: number; height: number } }) => {
    const naturalSize = e?.naturalSize;
    if (naturalSize?.width && naturalSize?.height) {
      const d = { w: naturalSize.width, h: naturalSize.height };
      dimensionsCache.set(uri, d);
      onImageDimensions(index, naturalSize.width, naturalSize.height);
    }
  };

  return (
    <TouchableOpacity
      onPress={() => onMediaPress(mediaFiles, index)}
      style={[
        styles.cell,
        {
          width: '100%',
          minWidth: displayWidth,
          maxWidth: maxWidth,
          aspectRatio: aspectRatio,
          borderRadius: BORDER_RADIUS,
        }
      ]}
      activeOpacity={0.9}
    >
      {isImage && (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onLoad={handleImageLoad}
        />
      )}
      {isVideo && (
        <>
          <Video
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted
            isLooping={false}
            useNativeControls={false}
            onReadyForDisplay={handleVideoReadyForDisplay}
          />
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={25} color="white" />
            </View>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: BORDER_RADIUS,
    marginVertical: 4,
  },
  emptyPlaceholder: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  placeholderText: { marginTop: 8, fontSize: 12, color: '#6b7280' },
  wrapper: { marginVertical: 4 },
  singleWrapper: { marginVertical: 4, width: '100%' },
  cell: {
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  audioCell: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  audioIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#8b5cf6',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BORDER_RADIUS,
  },
  plusText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
});

export default MediaGrid;