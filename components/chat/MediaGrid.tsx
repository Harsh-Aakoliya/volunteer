// components/chat/MediaGrid.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
  Animated as RNAnimated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getApiUrl } from '@/stores/apiStore';
import { getMediaFiles } from '@/api/chat/media';
import AudioMessagePlayer from '@/components/chat/AudioMessagePlayer';

// ==================== TYPES ====================

interface MediaFile {
  id: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  duration?: number; // video/audio duration in seconds
}

interface MediaGridProps {
  mediaFilesId: number;
  messageId: string | number;
  onMediaPress: (mediaFiles: MediaFile[], selectedIndex: number) => void;
  isOwnMessage: boolean;
  isLoading?: boolean;
}

// ==================== CACHES ====================

const mediaCache: Map<number, MediaFile[]> = new Map();
const dimensionsCache: Map<string, { w: number; h: number }> = new Map();
const loadingPromises: Map<number, Promise<MediaFile[]>> = new Map();

// ==================== CONSTANTS ====================

const SCREEN_W = Dimensions.get('window').width;
const GAP = 2;
const BORDER_RADIUS = 10;

// Bubble-relative sizing
const CONTAINER_MAX_W = Math.floor(SCREEN_W * 0.70);
const HALF_W = Math.floor((CONTAINER_MAX_W - GAP) / 2);
const THIRD_W = Math.floor((CONTAINER_MAX_W - GAP * 2) / 3);

// Single media constraints
const SINGLE_MAX_W = CONTAINER_MAX_W;
const SINGLE_MAX_H = Math.floor(SINGLE_MAX_W * 1.6); // max portrait height
const SINGLE_MIN_H = Math.floor(SINGLE_MAX_W * 0.4); // min landscape height

// Multi constraints
const MULTI_MAX_TOTAL_H = Math.floor(CONTAINER_MAX_W * 1.4);
const MIN_CELL = 70;

/**
 * Exported for the chat screen to constrain the bubble media section.
 */
export const MEDIA_CONTAINER_MAX_WIDTH = CONTAINER_MAX_W;

// ==================== HELPERS ====================

const getImageUri = (fileName: string) => `${getApiUrl()}/media/chat/${fileName}`;

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fit SINGLE image:
 *  - ALWAYS use full available width (SINGLE_MAX_W) so it lines up perfectly
 *    with the caption / bubble width (WhatsApp-style).
 *  - Adjust height based on aspect ratio, clamped between SINGLE_MIN_H and SINGLE_MAX_H.
 */
function fitSingle(imgW: number, imgH: number): { w: number; h: number } {
  if (imgW <= 0 || imgH <= 0) return { w: SINGLE_MAX_W, h: SINGLE_MAX_W };
  const aspect = imgH / imgW;
  const w = SINGLE_MAX_W;
  let h = w * aspect;

  if (h > SINGLE_MAX_H) {
    h = SINGLE_MAX_H;
  }
  if (h < SINGLE_MIN_H) {
    h = SINGLE_MIN_H;
  }

  return { w: Math.round(w), h: Math.round(h) };
}

/** Clamp total height of a layout keeping ratios */
function clampTotalHeight(heights: number[], maxTotal: number): number[] {
  const total = heights.reduce((a, b) => a + b, 0) + GAP * (heights.length - 1);
  if (total <= maxTotal) return heights;
  const scale = (maxTotal - GAP * (heights.length - 1)) / heights.reduce((a, b) => a + b, 0);
  return heights.map((h) => Math.max(Math.round(h * scale), MIN_CELL));
}

// ==================== IMAGE SHIMMER PLACEHOLDER ====================

const ShimmerPlaceholder: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const animValue = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(animValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(animValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <RNAnimated.View
      style={{
        width,
        height,
        backgroundColor: '#e0e0e0',
        opacity,
        borderRadius: BORDER_RADIUS,
      }}
    />
  );
};

// ==================== PROGRESSIVE IMAGE ====================

const ProgressiveImage: React.FC<{
  uri: string;
  width: number;
  height: number;
  resizeMode?: 'cover' | 'contain';
  borderRadius?: number;
  onDimensions?: (w: number, h: number) => void;
}> = React.memo(({ uri, width, height, resizeMode = 'cover', borderRadius = 0, onDimensions }) => {
  const [loaded, setLoaded] = useState(false);
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  const handleLoad = useCallback(
    (e: any) => {
      setLoaded(true);
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      const source = e?.nativeEvent?.source;
      if (source?.width && source?.height && onDimensions) {
        onDimensions(source.width, source.height);
      }
    },
    [onDimensions, fadeAnim]
  );

  return (
    <View style={{ width, height, borderRadius, overflow: 'hidden', backgroundColor: '#e8e8e8' }}>
      {!loaded && (
        <View style={StyleSheet.absoluteFill}>
          <ShimmerPlaceholder width={width} height={height} />
        </View>
      )}
      <RNAnimated.View style={{ opacity: fadeAnim, width, height }}>
        <Image
          source={{ uri }}
          style={{ width, height }}
          resizeMode={resizeMode}
          onLoad={handleLoad}
        />
      </RNAnimated.View>
    </View>
  );
});

// ==================== VIDEO THUMBNAIL CELL ====================

const VideoCell: React.FC<{
  file: MediaFile;
  width: number;
  height: number;
  resizeMode?: 'cover' | 'contain';
  onPress: () => void;
  onDimensions?: (w: number, h: number) => void;
}> = React.memo(({ file, width, height, resizeMode = 'cover', onPress, onDimensions }) => {
  const uri = getImageUri(file.fileName);

  const handleReady = useCallback(
    (e: any) => {
      const ns = e?.naturalSize;
      if (ns?.width && ns?.height && onDimensions) {
        dimensionsCache.set(uri, { w: ns.width, h: ns.height });
        onDimensions(ns.width, ns.height);
      }
    },
    [uri, onDimensions]
  );

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.cell, { width, height }]}>
      <Video
        source={{ uri }}
        style={{ width, height }}
        resizeMode={resizeMode === 'cover' ? ResizeMode.COVER : ResizeMode.CONTAIN}
        shouldPlay={false}
        isMuted
        isLooping={false}
        useNativeControls={false}
        onReadyForDisplay={handleReady}
      />
      <View style={styles.playOverlay}>
        <View style={styles.playCircle}>
          <Ionicons name="play" size={22} color="white" style={{ marginLeft: 2 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ==================== DOCUMENT FILE CELL ====================

const DocumentCell: React.FC<{
  file: MediaFile;
  width: number;
  height: number;
  onPress: () => void;
}> = React.memo(({ file, width, height, onPress }) => {
  const ext = file.originalName?.split('.').pop()?.toUpperCase() || 'FILE';
  const iconName = getDocumentIcon(file.mimeType);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.cell, styles.documentCell, { width, height }]}>
      <View style={styles.documentIconContainer}>
        <View style={[styles.documentIconCircle, { backgroundColor: getDocumentColor(ext) }]}>
          <Ionicons name={iconName as any} size={24} color="white" />
        </View>
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={1}>
          {file.originalName || file.fileName}
        </Text>
        <Text style={styles.documentMeta}>
          {ext} • {formatFileSize(file.size)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function getDocumentIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'document-text';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'easel';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive'))
    return 'file-tray-full';
  return 'document-attach';
}

function getDocumentColor(ext: string): string {
  switch (ext) {
    case 'PDF':
      return '#E53935';
    case 'DOC':
    case 'DOCX':
      return '#1565C0';
    case 'XLS':
    case 'XLSX':
      return '#2E7D32';
    case 'PPT':
    case 'PPTX':
      return '#D84315';
    case 'ZIP':
    case 'RAR':
      return '#6A1B9A';
    default:
      return '#546E7A';
  }
}

// ==================== GIF CELL ====================

const GifCell: React.FC<{
  file: MediaFile;
  width: number;
  height: number;
  onPress: () => void;
  onDimensions?: (w: number, h: number) => void;
}> = React.memo(({ file, width, height, onPress, onDimensions }) => {
  const uri = getImageUri(file.fileName);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.cell, { width, height }]}>
      <ProgressiveImage
        uri={uri}
        width={width}
        height={height}
        resizeMode="cover"
        onDimensions={onDimensions}
      />
      {/* GIF badge */}
      <View style={styles.gifBadge}>
        <Text style={styles.gifBadgeText}>GIF</Text>
      </View>
    </TouchableOpacity>
  );
});

// ==================== MEDIA GRID COMPONENT ====================

const MediaGrid: React.FC<MediaGridProps> = ({
  mediaFilesId,
  onMediaPress,
  isOwnMessage,
  messageId,
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dims, setDims] = useState<Record<number, { w: number; h: number }>>({});

  // ---- Fetch media files with dedup ----
  useEffect(() => {
    if (!mediaFilesId) {
      setMediaFiles([]);
      setLoading(false);
      setError(false);
      setDims({});
      return;
    }

    const cached = mediaCache.get(mediaFilesId);
    if (cached) {
      setMediaFiles(cached);
      setLoading(false);
      setError(false);
      prefetchDimensions(cached);
      return;
    }

    // Deduplicate concurrent requests
    let promise = loadingPromises.get(mediaFilesId);
    if (!promise) {
      promise = (async () => {
        const data = await getMediaFiles(mediaFilesId);
        if (data.success && data.media?.files) {
          const files: MediaFile[] = data.media.files.map((f: any) => ({
            id: f.id || Math.random(),
            fileName: f.url || f.filename,
            originalName: f.originalName || f.filename,
            mimeType: f.mimeType,
            size: f.size || 0,
            duration: f.duration,
          }));
          mediaCache.set(mediaFilesId, files);
          return files;
        }
        return [];
      })();
      loadingPromises.set(mediaFilesId, promise);
    }

    setLoading(true);
    setError(false);

    promise
      .then((files) => {
        setMediaFiles(files);
        prefetchDimensions(files);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
        loadingPromises.delete(mediaFilesId);
      });
  }, [mediaFilesId]);

  // ---- Prefetch image dimensions ----
  const prefetchDimensions = useCallback((files: MediaFile[]) => {
    files.forEach((file, idx) => {
      if (file.mimeType.startsWith('image')) {
        const uri = getImageUri(file.fileName);
        const cached = dimensionsCache.get(uri);
        if (cached) {
          setDims((prev) => ({ ...prev, [idx]: cached }));
        } else {
          Image.getSize(
            uri,
            (w, h) => {
              dimensionsCache.set(uri, { w, h });
              setDims((prev) => ({ ...prev, [idx]: { w, h } }));
            },
            () => {}
          );
        }
      } else if (file.mimeType.startsWith('video')) {
        setDims((prev) => ({ ...prev, [idx]: { w: 16, h: 9 } }));
      }
    });
  }, []);

  const onCellDimensions = useCallback(
    (index: number, w: number, h: number) => {
      const file = mediaFiles[index];
      if (file) {
        const uri = getImageUri(file.fileName);
        dimensionsCache.set(uri, { w, h });
      }
      setDims((prev) => ({ ...prev, [index]: { w, h } }));
    },
    [mediaFiles]
  );

  const getDim = useCallback(
    (index: number) => {
      return dims[index] || { w: 1, h: 1 };
    },
    [dims]
  );

  const isPortrait = useCallback(
    (index: number) => {
      const d = getDim(index);
      return d.h / d.w >= 1;
    },
    [getDim]
  );

  const aspect = useCallback(
    (index: number) => {
      const d = getDim(index);
      return d.w > 0 ? d.h / d.w : 1;
    },
    [getDim]
  );

  // ---- Classify file type ----
  const getFileType = useCallback((file: MediaFile) => {
    if (file.mimeType.startsWith('image/gif')) return 'gif';
    if (file.mimeType.startsWith('image')) return 'image';
    if (file.mimeType.startsWith('video')) return 'video';
    if (file.mimeType.startsWith('audio')) return 'audio';
    return 'document';
  }, []);

  // ---- Render individual cell ----
  const renderMediaCell = useCallback(
    (
      file: MediaFile,
      index: number,
      width: number,
      height: number,
      resizeMode: 'cover' | 'contain' = 'cover',
      cornerRadii?: {
        topLeft?: number;
        topRight?: number;
        bottomLeft?: number;
        bottomRight?: number;
      }
    ) => {
      const type = getFileType(file);
      const radius = cornerRadii || {};
      const cellStyle = {
        borderTopLeftRadius: radius.topLeft ?? 0,
        borderTopRightRadius: radius.topRight ?? 0,
        borderBottomLeftRadius: radius.bottomLeft ?? 0,
        borderBottomRightRadius: radius.bottomRight ?? 0,
      };

      const press = () => onMediaPress(mediaFiles, index);
      const dimCb = (w: number, h: number) => onCellDimensions(index, w, h);

      switch (type) {
        case 'gif':
          return (
            <View key={file.id} style={[{ width, height, overflow: 'hidden' }, cellStyle]}>
              <GifCell file={file} width={width} height={height} onPress={press} onDimensions={dimCb} />
            </View>
          );

        case 'image':
          return (
            <TouchableOpacity
              key={file.id}
              onPress={press}
              activeOpacity={0.85}
              style={[styles.cell, { width, height }, cellStyle]}
            >
              <ProgressiveImage
                uri={getImageUri(file.fileName)}
                width={width}
                height={height}
                resizeMode={resizeMode}
                onDimensions={dimCb}
              />
            </TouchableOpacity>
          );

        case 'video':
          return (
            <View key={file.id} style={[{ width, height, overflow: 'hidden' }, cellStyle]}>
              <VideoCell
                file={file}
                width={width}
                height={height}
                resizeMode={resizeMode}
                onPress={press}
                onDimensions={dimCb}
              />
            </View>
          );

        case 'audio':
          return (
            <View key={file.id} style={[{ width, height, overflow: 'hidden' }, cellStyle]}>
              <View style={[styles.audioCell, { width, height }]}>
                <View style={styles.audioIconCircle}>
                  <Ionicons name="musical-notes" size={Math.min(width, height) * 0.18} color="white" />
                </View>
                {file.duration != null && file.duration > 0 && (
                  <Text style={styles.audioDuration}>{formatDuration(file.duration)}</Text>
                )}
              </View>
            </View>
          );

        case 'document':
          return (
            <View key={file.id} style={[{ width, height, overflow: 'hidden' }, cellStyle]}>
              <DocumentCell file={file} width={width} height={height} onPress={press} />
            </View>
          );

        default:
          return null;
      }
    },
    [mediaFiles, onMediaPress, getFileType, onCellDimensions]
  );

  // ---- Corner radius helper for grid positions ----
  const getCornerRadii = useCallback(
    (position: 'single' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'top' | 'bottom' | 'left' | 'right' | 'middle') => {
      const R = BORDER_RADIUS;
      switch (position) {
        case 'single':
          return { topLeft: R, topRight: R, bottomLeft: R, bottomRight: R };
        case 'topLeft':
          return { topLeft: R };
        case 'topRight':
          return { topRight: R };
        case 'bottomLeft':
          return { bottomLeft: R };
        case 'bottomRight':
          return { bottomRight: R };
        case 'top':
          return { topLeft: R, topRight: R };
        case 'bottom':
          return { bottomLeft: R, bottomRight: R };
        case 'left':
          return { topLeft: R, bottomLeft: R };
        case 'right':
          return { topRight: R, bottomRight: R };
        case 'middle':
        default:
          return {};
      }
    },
    []
  );

  // ---- "+N" overlay ----
  const renderPlusOverlay = useCallback(
    (
      file: MediaFile,
      index: number,
      width: number,
      height: number,
      remaining: number,
      cornerRadii?: any
    ) => {
      return (
        <View key={`plus-${file.id}`} style={[{ width, height, overflow: 'hidden', position: 'relative' }, cornerRadii && {
          borderTopLeftRadius: cornerRadii.topLeft ?? 0,
          borderTopRightRadius: cornerRadii.topRight ?? 0,
          borderBottomLeftRadius: cornerRadii.bottomLeft ?? 0,
          borderBottomRightRadius: cornerRadii.bottomRight ?? 0,
        }]}>
          {renderMediaCell(file, index, width, height, 'cover')}
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, styles.plusOverlay]}
            onPress={() => onMediaPress(mediaFiles, index)}
            activeOpacity={0.9}
          >
            <BlurView intensity={Platform.OS === 'ios' ? 20 : 0} style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.plusText}>+{remaining}</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        </View>
      );
    },
    [renderMediaCell, onMediaPress, mediaFiles]
  );

  // ==================== LAYOUTS ====================

  const renderLayout = useMemo(() => {
    if (loading) return null;
    if (error || mediaFiles.length === 0) return null;

    const count = mediaFiles.length;

    // Separate audio files and visual files
    const audioFiles = mediaFiles.filter((f) => f.mimeType.startsWith('audio'));
    const visualFiles = mediaFiles.filter((f) => !f.mimeType.startsWith('audio'));
    const docFiles = mediaFiles.filter(
      (f) => !f.mimeType.startsWith('image') && !f.mimeType.startsWith('video') && !f.mimeType.startsWith('audio')
    );

    // ===== ONLY AUDIO FILES =====
    if (count === audioFiles.length) {
      return (
        <View style={{ width: CONTAINER_MAX_W }}>
          {audioFiles.map((file, idx) => (
            <View key={file.id} style={{ marginBottom: idx < audioFiles.length - 1 ? 4 : 0 }}>
              <AudioMessagePlayer
                audioUrl={getImageUri(file.fileName)}
                isOwnMessage={isOwnMessage}
              />
            </View>
          ))}
        </View>
      );
    }

    // ===== SINGLE AUDIO + handle separately =====
    if (audioFiles.length === 1 && visualFiles.length === 0 && docFiles.length === 0) {
      return (
        <AudioMessagePlayer
          audioUrl={getImageUri(audioFiles[0].fileName)}
          isOwnMessage={isOwnMessage}
        />
      );
    }

    // ===== ONLY DOCUMENTS =====
    if (count === docFiles.length) {
      return (
        <View style={{ width: CONTAINER_MAX_W }}>
          {docFiles.map((file, idx) => (
            <View key={file.id} style={{ marginBottom: idx < docFiles.length - 1 ? 4 : 0 }}>
              <DocumentCell
                file={file}
                width={CONTAINER_MAX_W}
                height={64}
                onPress={() => onMediaPress(mediaFiles, mediaFiles.indexOf(file))}
              />
            </View>
          ))}
        </View>
      );
    }

    // ===== VISUAL FILES LAYOUT =====
    // Work with the visual (image/video/gif) files for grid layout
    const visuals = visualFiles.length > 0 ? visualFiles : mediaFiles.filter((f) => !f.mimeType.startsWith('audio'));
    const vCount = visuals.length;

    if (vCount === 0) return null;

    // Map visual file back to original index in mediaFiles
    const originalIndex = (vFile: MediaFile) => mediaFiles.indexOf(vFile);

    // ---- 1 VISUAL ----
    if (vCount === 1) {
      const file = visuals[0];
      const idx = originalIndex(file);
      const d = getDim(idx);
      const { w, h } = fitSingle(d.w, d.h);

      return (
        <View style={[styles.gridContainer, { width: w }]}>
          {/* Single media should fully cover its cell (no grey borders) */}
          {renderMediaCell(file, idx, w, h, 'cover', getCornerRadii('single'))}
          {/* Render audio files below if mixed */}
          {audioFiles.map((af, ai) => (
            <View key={af.id} style={{ marginTop: 4 }}>
              <AudioMessagePlayer audioUrl={getImageUri(af.fileName)} isOwnMessage={isOwnMessage} />
            </View>
          ))}
          {docFiles.map((df) => (
            <View key={df.id} style={{ marginTop: 4 }}>
              <DocumentCell file={df} width={w} height={64} onPress={() => onMediaPress(mediaFiles, mediaFiles.indexOf(df))} />
            </View>
          ))}
        </View>
      );
    }

    // ---- 2 VISUALS ----
    if (vCount === 2) {
      const idx0 = originalIndex(visuals[0]);
      const idx1 = originalIndex(visuals[1]);
      const p0 = isPortrait(idx0);
      const p1 = isPortrait(idx1);

      // Both portrait → side by side
      if (p0 && p1) {
        const maxAspect = Math.max(aspect(idx0), aspect(idx1));
        let rowH = Math.round(HALF_W * Math.min(maxAspect, 1.8));
        rowH = Math.max(rowH, MIN_CELL);

        return (
          <View style={[styles.gridContainer, { width: CONTAINER_MAX_W }]}>
            <View style={styles.row}>
              {renderMediaCell(visuals[0], idx0, HALF_W, rowH, 'cover', getCornerRadii('topLeft'))}
              {renderMediaCell(visuals[1], idx1, HALF_W, rowH, 'cover', getCornerRadii('topRight'))}
            </View>
          </View>
        );
      }

      // Both landscape or mixed → stacked
      let h0 = Math.round(CONTAINER_MAX_W * Math.min(aspect(idx0), 0.8));
      let h1 = Math.round(CONTAINER_MAX_W * Math.min(aspect(idx1), 0.8));
      [h0, h1] = clampTotalHeight([h0, h1], MULTI_MAX_TOTAL_H);

      return (
        <View style={[styles.gridContainer, { width: CONTAINER_MAX_W }]}>
          <View style={[styles.column, { gap: GAP }]}>
            {renderMediaCell(visuals[0], idx0, CONTAINER_MAX_W, h0, 'cover', getCornerRadii('top'))}
            {renderMediaCell(visuals[1], idx1, CONTAINER_MAX_W, h1, 'cover', getCornerRadii('bottom'))}
          </View>
        </View>
      );
    }

    // ---- 3 VISUALS ----
    if (vCount === 3) {
      const idx0 = originalIndex(visuals[0]);
      const idx1 = originalIndex(visuals[1]);
      const idx2 = originalIndex(visuals[2]);
      const p0 = isPortrait(idx0);
      const p1 = isPortrait(idx1);
      const p2 = isPortrait(idx2);
      const portraitCount = [p0, p1, p2].filter(Boolean).length;

      // All portrait → 1 big left + 2 stacked right (WhatsApp L-shape)
      if (portraitCount >= 2) {
        // Use first portrait as big, rest stacked
        const bigIdx = p0 ? 0 : p1 ? 1 : 2;
        const smallIndices = [0, 1, 2].filter((i) => i !== bigIdx);
        const bigFile = visuals[bigIdx];
        const bigOrigIdx = originalIndex(bigFile);
        const bigW = HALF_W;
        const smallW = HALF_W;

        let smallH0 = Math.round(smallW * Math.min(aspect(originalIndex(visuals[smallIndices[0]])), 1.5));
        let smallH1 = Math.round(smallW * Math.min(aspect(originalIndex(visuals[smallIndices[1]])), 1.5));
        let bigH = smallH0 + GAP + smallH1;
        const maxH = Math.round(CONTAINER_MAX_W * 1.3);
        if (bigH > maxH) {
          const scale = maxH / bigH;
          smallH0 = Math.round(smallH0 * scale);
          smallH1 = Math.round(smallH1 * scale);
          bigH = smallH0 + GAP + smallH1;
        }
        smallH0 = Math.max(smallH0, MIN_CELL);
        smallH1 = Math.max(smallH1, MIN_CELL);
        bigH = smallH0 + GAP + smallH1;

        return (
          <View style={[styles.gridContainer, { width: CONTAINER_MAX_W }]}>
            <View style={[styles.row, { gap: GAP, height: bigH }]}>
              {renderMediaCell(bigFile, bigOrigIdx, bigW, bigH, 'cover', getCornerRadii('left'))}
              <View style={[styles.column, { gap: GAP, width: smallW }]}>
                {renderMediaCell(
                  visuals[smallIndices[0]],
                  originalIndex(visuals[smallIndices[0]]),
                  smallW,
                  smallH0,
                  'cover',
                  getCornerRadii('topRight')
                )}
                {renderMediaCell(
                  visuals[smallIndices[1]],
                  originalIndex(visuals[smallIndices[1]]),
                  smallW,
                  smallH1,
                  'cover',
                  getCornerRadii('bottomRight')
                )}
              </View>
            </View>
          </View>
        );
      }

      // All landscape or mixed → top full width + bottom two side by side
      let topH = Math.round(CONTAINER_MAX_W * Math.min(aspect(idx0), 0.65));
      let bottomH = Math.round(HALF_W * Math.max(aspect(idx1), aspect(idx2)));
      [topH, bottomH] = clampTotalHeight([topH, bottomH], MULTI_MAX_TOTAL_H);

      return (
        <View style={[styles.gridContainer, { width: CONTAINER_MAX_W }]}>
          <View style={[styles.column, { gap: GAP }]}>
            {renderMediaCell(visuals[0], idx0, CONTAINER_MAX_W, topH, 'cover', getCornerRadii('top'))}
            <View style={[styles.row, { gap: GAP }]}>
              {renderMediaCell(visuals[1], idx1, HALF_W, bottomH, 'cover', getCornerRadii('bottomLeft'))}
              {renderMediaCell(visuals[2], idx2, HALF_W, bottomH, 'cover', getCornerRadii('bottomRight'))}
            </View>
          </View>
        </View>
      );
    }

    // ---- 4 VISUALS ----
    if (vCount === 4) {
      const idx0 = originalIndex(visuals[0]);
      const idx1 = originalIndex(visuals[1]);
      const idx2 = originalIndex(visuals[2]);
      const idx3 = originalIndex(visuals[3]);

      // 2x2 grid
      let topH = Math.round(HALF_W * Math.max(aspect(idx0), aspect(idx1)));
      let bottomH = Math.round(HALF_W * Math.max(aspect(idx2), aspect(idx3)));
      [topH, bottomH] = clampTotalHeight([topH, bottomH], MULTI_MAX_TOTAL_H);
      topH = Math.max(topH, MIN_CELL);
      bottomH = Math.max(bottomH, MIN_CELL);

      return (
        <View style={[styles.gridContainer, { width: CONTAINER_MAX_W }]}>
          <View style={[styles.column, { gap: GAP }]}>
            <View style={[styles.row, { gap: GAP }]}>
              {renderMediaCell(visuals[0], idx0, HALF_W, topH, 'cover', getCornerRadii('topLeft'))}
              {renderMediaCell(visuals[1], idx1, HALF_W, topH, 'cover', getCornerRadii('topRight'))}
            </View>
            <View style={[styles.row, { gap: GAP }]}>
              {renderMediaCell(visuals[2], idx2, HALF_W, bottomH, 'cover', getCornerRadii('bottomLeft'))}
              {renderMediaCell(visuals[3], idx3, HALF_W, bottomH, 'cover', getCornerRadii('bottomRight'))}
            </View>
          </View>
        </View>
      );
    }

    // ---- 5+ VISUALS ---- Top row: first image large, right: 2 stacked, bottom: remaining in row with +N
    if (vCount >= 5) {
      const maxVisible = 6;
      const visible = visuals.slice(0, maxVisible);
      const remaining = vCount > maxVisible ? vCount - maxVisible : 0;
      const lastVisibleIdx = visible.length - 1;

      // Layout: top big image + 2 right, bottom row of remaining
      const idx0 = originalIndex(visible[0]);
      const idx1 = originalIndex(visible[1]);
      const idx2 = originalIndex(visible[2]);

      const topBigW = Math.floor(CONTAINER_MAX_W * 0.6);
      const topSmallW = CONTAINER_MAX_W - topBigW - GAP;
      let topSmallH1 = Math.round(topSmallW * Math.min(aspect(idx1), 1.2));
      let topSmallH2 = Math.round(topSmallW * Math.min(aspect(idx2), 1.2));
      let topH = topSmallH1 + GAP + topSmallH2;
      const maxTopH = Math.round(CONTAINER_MAX_W * 0.9);
      if (topH > maxTopH) {
        const scale = maxTopH / topH;
        topSmallH1 = Math.round(topSmallH1 * scale);
        topSmallH2 = Math.round(topSmallH2 * scale);
        topH = topSmallH1 + GAP + topSmallH2;
      }
      topSmallH1 = Math.max(topSmallH1, MIN_CELL);
      topSmallH2 = Math.max(topSmallH2, MIN_CELL);
      topH = topSmallH1 + GAP + topSmallH2;

      const bottomFiles = visible.slice(3);
      const bottomCount = bottomFiles.length;
      const bottomCellW =
        bottomCount > 0
          ? Math.floor((CONTAINER_MAX_W - GAP * (bottomCount - 1)) / bottomCount)
          : 0;
      const bottomH = bottomCount > 0 ? Math.max(Math.round(bottomCellW * 0.9), MIN_CELL) : 0;

      return (
        <View style={[styles.gridContainer, { width: CONTAINER_MAX_W }]}>
          <View style={[styles.column, { gap: GAP }]}>
            {/* Top section */}
            <View style={[styles.row, { gap: GAP, height: topH }]}>
              {renderMediaCell(visible[0], idx0, topBigW, topH, 'cover', getCornerRadii('topLeft'))}
              <View style={[styles.column, { gap: GAP, width: topSmallW }]}>
                {renderMediaCell(visible[1], idx1, topSmallW, topSmallH1, 'cover', getCornerRadii('topRight'))}
                {renderMediaCell(visible[2], idx2, topSmallW, topSmallH2, 'cover')}
              </View>
            </View>
            {/* Bottom row */}
            {bottomCount > 0 && (
              <View style={[styles.row, { gap: GAP }]}>
                {bottomFiles.map((file, i) => {
                  const oIdx = originalIndex(file);
                  const isLast = i === bottomCount - 1;
                  const corners =
                    i === 0 && isLast
                      ? getCornerRadii('bottom')
                      : i === 0
                      ? getCornerRadii('bottomLeft')
                      : isLast
                      ? getCornerRadii('bottomRight')
                      : getCornerRadii('middle');

                  if (isLast && remaining > 0) {
                    return renderPlusOverlay(file, oIdx, bottomCellW, bottomH, remaining, corners);
                  }
                  return renderMediaCell(file, oIdx, bottomCellW, bottomH, 'cover', corners);
                })}
              </View>
            )}
          </View>
        </View>
      );
    }

    return null;
  }, [
    loading,
    error,
    mediaFiles,
    dims,
    isOwnMessage,
    getDim,
    isPortrait,
    aspect,
    getFileType,
    getCornerRadii,
    renderMediaCell,
    renderPlusOverlay,
    onMediaPress,
  ]);

  // ==================== RENDER ====================

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { width: CONTAINER_MAX_W, height: 160 }]}>
        <ShimmerPlaceholder width={CONTAINER_MAX_W} height={160} />
      </View>
    );
  }

  if (error) {
    return (
      <TouchableOpacity
        style={[styles.errorContainer, { width: CONTAINER_MAX_W }]}
        onPress={() => {
          mediaCache.delete(mediaFilesId);
          setError(false);
          setLoading(true);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="reload-circle" size={32} color="#9ca3af" />
        <Text style={styles.errorText}>Tap to retry</Text>
      </TouchableOpacity>
    );
  }

  if (mediaFiles.length === 0) {
    return (
      <View style={[styles.emptyContainer, { width: CONTAINER_MAX_W }]}>
        <Ionicons name="image-outline" size={28} color="#9ca3af" />
        <Text style={styles.emptyText}>No media</Text>
      </View>
    );
  }

  return <View style={styles.outerContainer}>{renderLayout}</View>;
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  outerContainer: {
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS,
    width: '100%',
  },
  gridContainer: {
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  column: {
    flexDirection: 'column',
  },
  cell: {
    overflow: 'hidden',
    backgroundColor: '#e8e8e8',
  },

  // Video
  videoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  videoDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  videoDurationText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '600',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },

  // Audio
  audioCell: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  audioIconCircle: {
    width: 56,
    height: 56,
    backgroundColor: '#8b5cf6',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioDuration: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Document
  documentCell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  documentIconContainer: {
    marginRight: 12,
  },
  documentIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  documentMeta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  // GIF
  gifBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gifBadgeText: {
    fontSize: 11,
    color: 'white',
    fontWeight: 'bold',
  },

  // +N overlay
  plusOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  plusText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // States
  loadingContainer: {
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS,
  },
  errorContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default React.memo(MediaGrid);