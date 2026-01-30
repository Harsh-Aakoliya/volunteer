import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import MediaViewerModal from '@/components/chat/MediaViewerModal';

const NUM_COLUMNS = 3;
const ITEM_MARGIN = 2;
const PAGE_SIZE = 15;

interface MediaFile {
  id: number;
  fileName: string;
  originalName?: string;
  mimeType: string;
  size?: number;
}

export interface RoomMediaItem {
  key: string;
  messageId: number;
  mediaFilesId: number;
  file: MediaFile;
}

async function fetchMediaFiles(
  mediaFilesId: number,
  token: string | null
): Promise<MediaFile[]> {
  if (!token) return [];
  const res = await fetch(`${API_URL}/api/vm-media/media/${mediaFilesId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.success || !data.media?.files) return [];
  return (data.media.files as any[]).map((f: any) => ({
    id: f.id ?? Math.random(),
    fileName: f.url || f.filename || '',
    originalName: f.originalName || f.filename,
    mimeType: f.mimeType || 'image/jpeg',
    size: f.size || 0,
  }));
}

// Memoized cell to avoid re-renders and reduce scroll lag
const MediaGridCell = React.memo(function MediaGridCell({
  item,
  itemSize,
  onPress,
}: {
  item: RoomMediaItem;
  itemSize: number;
  onPress: () => void;
}) {
  const { file } = item;
  const isImage = file.mimeType.startsWith('image');
  const isVideo = file.mimeType.startsWith('video');
  const uri = `${API_URL}/media/chat/${file.fileName}`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        width: itemSize,
        height: itemSize,
        margin: ITEM_MARGIN / 2,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#f3f4f6',
      }}
    >
      {isImage && (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.key}
        />
      )}
      {isVideo && (
        <View
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#e5e7eb',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="play" size={24} color="white" />
          </View>
        </View>
      )}
      {!isImage && !isVideo && (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#e5e7eb',
          }}
        >
          <Ionicons name="document-outline" size={28} color="#6b7280" />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function MediaTab({ messages }: { messages: any[] }) {
  const { width } = useWindowDimensions();
  const itemSize = (width - ITEM_MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
  const rowHeight = itemSize + ITEM_MARGIN;

  const [items, setItems] = useState<RoomMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerFiles, setViewerFiles] = useState<{ fileName: string; originalName?: string; mimeType: string; size?: number }[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Cache: messageId -> MediaFile[]
  const [fileCache, setFileCache] = useState<Record<number, MediaFile[]>>({});
  // Cursor: next (messageIndex, fileIndex) to read from
  const [cursor, setCursor] = useState({ messageIndex: 0, fileIndex: 0 });
  const cursorRef = useRef(cursor);
  const fileCacheRef = useRef(fileCache);
  cursorRef.current = cursor;
  fileCacheRef.current = fileCache;

  const mediaMessages = useMemo(
    () => messages.filter((m) => m.messageType === 'media' && m.mediaFilesId),
    [messages]
  );

  const mediaMessagesKey = useMemo(
    () => mediaMessages.map((m) => `${m.id}-${m.mediaFilesId}`).sort().join(','),
    [mediaMessages]
  );

  const hasMore = useMemo(() => {
    if (mediaMessages.length === 0) return false;
    const { messageIndex, fileIndex } = cursor;
    if (messageIndex >= mediaMessages.length) return false;
    const cached = fileCache[mediaMessages[messageIndex].id];
    if (!cached) return true; // still have messages to fetch
    if (fileIndex < cached.length) return true;
    if (messageIndex + 1 < mediaMessages.length) return true;
    return false;
  }, [mediaMessages, cursor, fileCache]);

  const loadNextPage = useCallback(
    async (isInitial: boolean) => {
      if (mediaMessages.length === 0) {
        if (isInitial) setLoading(false);
        return;
      }
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const token = await AuthStorage.getToken();
      const cur = isInitial ? { messageIndex: 0, fileIndex: 0 } : cursorRef.current;
      const cache = isInitial ? {} : fileCacheRef.current;
      let messageIndex = cur.messageIndex;
      let fileIndex = cur.fileIndex;
      const nextItems: RoomMediaItem[] = [];
      let collected = 0;
      let newCache = { ...cache };

      while (collected < PAGE_SIZE && messageIndex < mediaMessages.length) {
        const msg = mediaMessages[messageIndex];
        let files = newCache[msg.id];

        if (!files) {
          files = await fetchMediaFiles(msg.mediaFilesId, token);
          newCache = { ...newCache, [msg.id]: files };
        }

        const start = fileIndex;
        const take = Math.min(PAGE_SIZE - collected, files.length - start);
        for (let i = 0; i < take; i++) {
          const file = files[start + i];
          nextItems.push({
            key: `${msg.id}-${file.id}`,
            messageId: msg.id,
            mediaFilesId: msg.mediaFilesId,
            file,
          });
          collected++;
        }

        fileIndex += take;
        if (fileIndex >= files.length) {
          messageIndex++;
          fileIndex = 0;
        }
      }

      setFileCache(newCache);
      setCursor({ messageIndex, fileIndex });
      setItems((prev) => (isInitial ? nextItems : [...prev, ...nextItems]));
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    },
    [mediaMessages]
  );

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setFileCache({});
    setCursor({ messageIndex: 0, fileIndex: 0 });

    const run = async () => {
      const token = await AuthStorage.getToken();
      if (mediaMessages.length === 0) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setLoading(true);
      let messageIndex = 0;
      let fileIndex = 0;
      const cache: Record<number, MediaFile[]> = {};
      const firstPage: RoomMediaItem[] = [];
      let collected = 0;

      while (collected < PAGE_SIZE && messageIndex < mediaMessages.length) {
        const msg = mediaMessages[messageIndex];
        let files = cache[msg.id];
        if (!files) {
          files = await fetchMediaFiles(msg.mediaFilesId, token);
          cache[msg.id] = files;
        }
        const start = fileIndex;
        const take = Math.min(PAGE_SIZE - collected, files.length - start);
        for (let i = 0; i < take; i++) {
          const file = files[start + i];
          firstPage.push({
            key: `${msg.id}-${file.id}`,
            messageId: msg.id,
            mediaFilesId: msg.mediaFilesId,
            file,
          });
          collected++;
        }
        fileIndex += take;
        if (fileIndex >= files.length) {
          messageIndex++;
          fileIndex = 0;
        }
      }

      if (!cancelled) {
        setItems(firstPage);
        setFileCache(cache);
        setCursor({ messageIndex, fileIndex });
      }
      if (!cancelled) setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [mediaMessagesKey]);

  const handleEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    loadNextPage(false);
  }, [loading, loadingMore, hasMore, loadNextPage]);

  const openViewer = useCallback((index: number) => {
    const files = items.map((i) => ({
      fileName: i.file.fileName,
      originalName: i.file.originalName,
      mimeType: i.file.mimeType,
      size: i.file.size,
    }));
    setViewerFiles(files);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  }, [items]);

  const renderItem = useCallback(
    ({ item, index }: { item: RoomMediaItem; index: number }) => (
      <MediaGridCell
        item={item}
        itemSize={itemSize}
        onPress={() => openViewer(index)}
      />
    ),
    [itemSize, openViewer]
  );

  const keyExtractor = useCallback((item: RoomMediaItem) => item.key, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: rowHeight,
      offset: rowHeight * Math.floor(index / NUM_COLUMNS),
      index,
    }),
    [rowHeight]
  );

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-gray-500 mt-2">Loading media…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
        <Text className="text-gray-600 mt-4 text-center">Failed to load media</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        windowSize={5}
        removeClippedSubviews={true}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={
          items.length === 0
            ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
            : { padding: ITEM_MARGIN, paddingBottom: 24 }
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <>
            <Ionicons name="images-outline" size={64} color="#d1d5db" />
            <Text className="text-gray-600 mt-4 text-lg font-medium">
              No Media Files
            </Text>
            <Text className="text-gray-400 mt-2 text-center px-6">
              Photos and videos shared in this room will appear here
            </Text>
          </>
        }
      />

      <MediaViewerModal
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        mediaFiles={viewerFiles.length > 0 ? viewerFiles : undefined}
        initialIndex={viewerInitialIndex}
      />
    </View>
  );
}