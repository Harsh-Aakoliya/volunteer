import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Video, ResizeMode } from 'expo-av';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
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

// Cache for media files
const mediaCache: Map<number, MediaFile[]> = new Map();
// Cache for image dimensions (uri -> {w, h})
const dimensionsCache: Map<string, { w: number; h: number }> = new Map();

const GAP = 4;
const CONTAINER_WIDTH = 260;
const CONTAINER_WIDTH_WIDE = 320; // For PPP and PLL/LPL/LLP/LLL – wider layout
const HALF_WIDTH = (CONTAINER_WIDTH - GAP) / 2;
const MAX_SINGLE_WIDTH = 260;
const MAX_SINGLE_HEIGHT = 360;
const MIN_CELL_SIZE = 80;
const BORDER_RADIUS = 8;

// Compute display size from actual dimensions - Telegram style: adapt BOTH width and height
// Portrait images → narrower bubble, landscape → full width bubble, no white patches
function fitInBox(imgW: number, imgH: number): { w: number; h: number } {
  if (imgW <= 0 || imgH <= 0) return { w: MAX_SINGLE_WIDTH, h: MAX_SINGLE_WIDTH };
  const aspect = imgH / imgW;
  const maxAspect = MAX_SINGLE_HEIGHT / MAX_SINGLE_WIDTH;
  if (aspect >= maxAspect) {
    // Portrait or tall: limit by height, width shrinks (narrower bubble)
    const h = MAX_SINGLE_HEIGHT;
    const w = h / aspect;
    return { w, h };
  }
  // Landscape or wide: limit by width, height shrinks
  const w = MAX_SINGLE_WIDTH;
  const h = w * aspect;
  return { w, h };
}

const getImageUri = (fileName: string) => `${API_URL}/media/chat/${fileName}`;

const MediaGrid: React.FC<MediaGridProps> = ({
  mediaFilesId,
  onMediaPress,
  isOwnMessage,
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dimensions, setDimensions] = useState<Record<number, { w: number; h: number }>>({});

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
          // Pre-fetch dimensions; onLoad in SingleMediaDisplay is fallback when this fails (e.g. auth)
          Image.getSize(
            uri,
            (w, h) => {
              const d = { w, h };
              dimensionsCache.set(uri, d);
              setDimensions((prev) => ({ ...prev, [index]: d }));
            },
            () => { /* onLoad will provide dimensions when image renders */ }
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
        const token = await AuthStorage.getToken();
        const res = await fetch(`${API_URL}/api/vm-media/media/${mediaFilesId}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to load media');
        const data = await res.json();
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

  const renderCell = (
    file: MediaFile,
    index: number,
    width: number,
    height: number,
    borderRadius: number = BORDER_RADIUS,
    resizeMode: 'cover' | 'contain' = 'cover'
  ) => {
    const isImage = file.mimeType.startsWith('image');
    const isVideo = file.mimeType.startsWith('video');
    const isAudio = file.mimeType.startsWith('audio');
    const uri = getImageUri(file.fileName);

    return (
      <TouchableOpacity
        key={file.id}
        onPress={() => onMediaPress(mediaFiles, index)}
        style={[styles.cell, { width, height, borderRadius }]}
        activeOpacity={0.9}
      >
        {isImage && (
          <Image
            source={{ uri }}
            style={{ width, height }}
            resizeMode={resizeMode}
          />
        )}
        {isVideo && (
          <Video
            source={{ uri }}
            style={{ width, height }}
            resizeMode={resizeMode === 'cover' ? ResizeMode.COVER : ResizeMode.CONTAIN}
            shouldPlay={false}
            isMuted
            isLooping={false}
            useNativeControls={false}
            onReadyForDisplay={handleVideoReadyInCell(index, uri)}
          />
        )}
        {isAudio && (
          <View style={[styles.audioCell, { width, height }]}>
            <View style={styles.audioIcon}>
              <Ionicons name="musical-notes" size={width * 0.2} color="white" />
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

  // Loading
  if (loading) {
    return (
      <View style={[styles.placeholder, { height: 140 }]}>
        <ActivityIndicator size="small" color="#6b7280" />
        <Text style={styles.placeholderText}>Loading media...</Text>
      </View>
    );
  }

  // Error / empty
  if (error || mediaFiles.length === 0) {
    return (
      <View style={[styles.placeholder, styles.emptyPlaceholder, { height: 140 }]}>
        <Ionicons name="image-outline" size={32} color="#9ca3af" />
        <Text style={styles.placeholderText}>No media files</Text>
      </View>
    );
  }

  const count = mediaFiles.length;
  const single = mediaFiles[0];

  // Single audio → inline player
  if (count === 1 && single.mimeType.startsWith('audio')) {
    return (
      <AudioMessagePlayer
        audioUrl={getImageUri(single.fileName)}
        isOwnMessage={isOwnMessage}
      />
    );
  }

  // Single image/video – Telegram style: adapt width AND height from actual dimensions
  // Portrait → narrower bubble, landscape → full width, no white patches
  if (count === 1) {
    const dim = getDim(0);
    const { w, h } = fitInBox(dim.w, dim.h);

    return (
      <View style={styles.singleWrapper}>
        <SingleMediaDisplay
          file={single}
          index={0}
          displayWidth={w}
          displayHeight={h}
          mediaFiles={mediaFiles}
          onMediaPress={onMediaPress}
          onImageDimensions={onImageDimensions}
        />
      </View>
    );
  }

  // Two files – side-by-side only when both portrait; stacked when both landscape or mixed
  if (count === 2) {
    const d0 = getDim(0);
    const d1 = getDim(1);
    const aspect0 = d0.h / d0.w;
    const aspect1 = d1.h / d1.w;
    const portrait0 = aspect0 >= 1;
    const portrait1 = aspect1 >= 1;
    const bothPortrait = portrait0 && portrait1;

    if (bothPortrait) {
      // Side-by-side
      const rowH = Math.max(HALF_WIDTH * aspect0, HALF_WIDTH * aspect1, MIN_CELL_SIZE);
      return (
        <View style={styles.wrapper}>
          <View style={[styles.row2, { height: rowH }]}>
            {mediaFiles.map((f, i) => (
              <View key={f.id} style={{ width: HALF_WIDTH, height: rowH }}>
                {renderCell(f, i, HALF_WIDTH, rowH)}
              </View>
            ))}
          </View>
        </View>
      );
    }

    // Stacked: both landscape, or mixed (one portrait + one landscape)
    const h0 = Math.max(CONTAINER_WIDTH * aspect0, MIN_CELL_SIZE);
    const h1 = Math.max(CONTAINER_WIDTH * aspect1, MIN_CELL_SIZE);
    return (
      <View style={styles.wrapper}>
        <View style={[styles.stack2, { height: h0 + GAP + h1 }]}>
          <View style={{ width: CONTAINER_WIDTH, height: h0 }}>
            {renderCell(mediaFiles[0], 0, CONTAINER_WIDTH, h0)}
          </View>
          <View style={{ width: CONTAINER_WIDTH, height: h1 }}>
            {renderCell(mediaFiles[1], 1, CONTAINER_WIDTH, h1)}
          </View>
        </View>
      </View>
    );
  }

  // Three files OR 4+ files (show first 3 with same layout, +N overlay on 3rd when 4+)
  if (count >= 3) {
    const visible = count >= 4 ? mediaFiles.slice(0, 3) : mediaFiles;
    const remaining = count >= 4 ? count - 3 : undefined;

    const d0 = getDim(0);
    const d1 = getDim(1);
    const d2 = getDim(2);
    const p0 = d0.h / d0.w >= 1;
    const p1 = d1.h / d1.w >= 1;
    const p2 = d2.h / d2.w >= 1;
    const orientations = [p0, p1, p2];
    const portraitCount = orientations.filter(Boolean).length;

    const renderThird = (w: number, h: number) =>
      remaining != null ? (
        <View style={{ width: w, height: h, position: 'relative' }}>
          {renderCell(visible[2], 2, w, h)}
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, styles.plusOverlay]}
            onPress={() => onMediaPress(mediaFiles, 3)}
            activeOpacity={1}
          >
            <View style={styles.plusInner}>
              <Text style={styles.plusText}>+{remaining}</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        renderCell(visible[2], 2, w, h)
      );

    // Case 1 (PPP): L-shape – 1 portrait left, 2 portraits stacked right (wider layout)
    if (p0 && p1 && p2) {
      const W = CONTAINER_WIDTH_WIDE;
      const halfW = (W - GAP) / 2;
      const rightTopH = Math.max(halfW * (d1.h / d1.w), MIN_CELL_SIZE);
      const rightBottomH = Math.max(halfW * (d2.h / d2.w), MIN_CELL_SIZE);
      const leftH = rightTopH + GAP + rightBottomH;
      return (
        <View style={[styles.wrapper, { width: W }]}>
          <View style={[styles.row3, { height: leftH, width: W }]}>
            <View style={{ width: halfW, height: leftH }}>
              {renderCell(visible[0], 0, halfW, leftH)}
            </View>
            <View style={[styles.stackRight, { height: leftH, width: halfW }]}>
              <View style={{ height: rightTopH }}>
                {renderCell(visible[1], 1, halfW, rightTopH)}
              </View>
              <View style={{ height: rightBottomH }}>{renderThird(halfW, rightBottomH)}</View>
            </View>
          </View>
        </View>
      );
    }

    // Cases 2,3,4 (PPL, PLP, LPP): 2 portraits side-by-side on top, 1 landscape full width below (narrow layout)
    if (portraitCount === 2) {
      const portraitIndices = [0, 1, 2].filter((i) => orientations[i]);
      const landscapeIndex = [0, 1, 2].find((i) => !orientations[i])!;
      const topH = Math.max(
        HALF_WIDTH * (getDim(portraitIndices[0]).h / getDim(portraitIndices[0]).w),
        HALF_WIDTH * (getDim(portraitIndices[1]).h / getDim(portraitIndices[1]).w),
        MIN_CELL_SIZE
      );
      const bottomD = getDim(landscapeIndex);
      const bottomH = Math.max(CONTAINER_WIDTH * (bottomD.h / bottomD.w), MIN_CELL_SIZE);

      const cell = (idx: number, w: number, h: number) =>
        idx === 2 && remaining != null
          ? renderThird(w, h)
          : renderCell(visible[idx], idx, w, h);

      return (
        <View style={[styles.wrapper, { width: CONTAINER_WIDTH }]}>
          <View style={[styles.stack2, { height: topH + GAP + bottomH }]}>
            <View style={[styles.row2, { height: topH }]}>
              <View style={{ width: HALF_WIDTH, height: topH }}>
                {cell(portraitIndices[0], HALF_WIDTH, topH)}
              </View>
              <View style={{ width: HALF_WIDTH, height: topH }}>
                {cell(portraitIndices[1], HALF_WIDTH, topH)}
              </View>
            </View>
            <View style={{ width: CONTAINER_WIDTH, height: bottomH }}>
              {cell(landscapeIndex, CONTAINER_WIDTH, bottomH)}
            </View>
          </View>
        </View>
      );
    }

    // Cases 5,6,7,8 (PLL, LPL, LLP, LLL): all stacked top to bottom (wider layout)
    const W = CONTAINER_WIDTH_WIDE;
    const h0 = Math.max(W * (d0.h / d0.w), MIN_CELL_SIZE);
    const h1 = Math.max(W * (d1.h / d1.w), MIN_CELL_SIZE);
    const h2 = Math.max(W * (d2.h / d2.w), MIN_CELL_SIZE);
    return (
      <View style={[styles.wrapper, { width: W }]}>
        <View style={[styles.stack2, { height: h0 + GAP + h1 + GAP + h2, width: W }]}>
          <View style={{ width: W, height: h0 }}>
            {renderCell(visible[0], 0, W, h0)}
          </View>
          <View style={{ width: W, height: h1 }}>
            {renderCell(visible[1], 1, W, h1)}
          </View>
          <View style={{ width: W, height: h2 }}>{renderThird(W, h2)}</View>
        </View>
      </View>
    );
  }

  return null;
};

// Single media (image/video) with adaptive sizing - uses Image onLoad / Video onReadyForDisplay for real dimensions
const SingleMediaDisplay: React.FC<{
  file: MediaFile;
  index: number;
  displayWidth: number;
  displayHeight: number;
  mediaFiles: MediaFile[];
  onMediaPress: (files: MediaFile[], idx: number) => void;
  onImageDimensions: (index: number, w: number, h: number) => void;
}> = ({ file, index, displayWidth, displayHeight, mediaFiles, onMediaPress, onImageDimensions }) => {
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
      style={[styles.cell, { width: displayWidth, height: displayHeight, borderRadius: BORDER_RADIUS }]}
      activeOpacity={0.9}
    >
      {isImage && (
        <Image
          source={{ uri }}
          style={{ width: displayWidth, height: displayHeight }}
          resizeMode="contain"
          onLoad={handleImageLoad}
        />
      )}
      {isVideo && (
        <>
          <Video
            source={{ uri }}
            style={{ width: displayWidth, height: displayHeight }}
            resizeMode={ResizeMode.CONTAIN}
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

const VideoThumbnail: React.FC<{ fileName: string; width: number; height: number }> = ({
  fileName,
  width,
  height,
}) => {
  const videoUrl = getImageUri(fileName);
  const player = useVideoPlayer(videoUrl, (p) => {
    if (p) {
      p.loop = false;
      p.muted = true;
      p.pause();
    }
  });

  return (
    <View style={[styles.videoWrap, { width, height }]}>
      <VideoView
        style={{ width, height }}
        player={player}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        showsTimecodes={false}
        requiresLinearPlayback
      />
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    width: CONTAINER_WIDTH,
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
  singleWrapper: { marginVertical: 4 },
  cell: {
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  row2: {
    width: CONTAINER_WIDTH,
    flexDirection: 'row',
    gap: GAP,
  },
  stack2: {
    width: CONTAINER_WIDTH,
    flexDirection: 'column',
    gap: GAP,
  },
  row3: {
    width: CONTAINER_WIDTH,
    flexDirection: 'row',
    gap: GAP,
  },
  stackRight: {
    width: HALF_WIDTH,
    gap: GAP,
  },
  grid4: {
    width: CONTAINER_WIDTH,
    gap: GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GAP,
    height: (CONTAINER_WIDTH - GAP) / 2,
  },
  audioCell: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  audioIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#8b5cf6',
    borderRadius: 40,
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
  videoWrap: { overflow: 'hidden' },
  plusOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  plusInner: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
});

export default MediaGrid;
