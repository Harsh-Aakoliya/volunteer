import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';

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

const MediaGrid: React.FC<MediaGridProps> = ({
  mediaFilesId,
  messageId,
  onMediaPress,
  isOwnMessage,
  isLoading = false,
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Grid dimensions - reduced to prevent overlapping
  const containerWidth = 260;
  const itemSize = (containerWidth - 6) / 2; // Account for gaps
  const borderRadius = 8;

  useEffect(() => {
    loadMediaFiles();
  }, [mediaFilesId]);

  const loadMediaFiles = async () => {
    try {
      setLoading(true);
      setError(false);
      
      // Get auth token
      const token = await AuthStorage.getToken();
      
      // Use the vm-media endpoint to get media files
      const response = await fetch(`${API_URL}/api/vm-media/media/${mediaFilesId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load media files');
      }
      
      const data = await response.json();
      if (data.success && data.media && data.media.files) {
        // Transform the data to match our interface
        const transformedFiles = data.media.files.map((file: any) => ({
          id: file.id || Math.random(),
          fileName: file.url || file.filename,
          originalName: file.originalName || file.filename,
          mimeType: file.mimeType,
          size: file.size || 0
        }));
        setMediaFiles(transformedFiles);
      } else {
        setMediaFiles([]);
      }
    } catch (error) {
      console.error('Error loading media files:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const renderMediaItem = (file: MediaFile, index: number, size: number, borderRadius: number) => {
    const isImage = file.mimeType.startsWith('image');
    const isVideo = file.mimeType.startsWith('video');
    const isAudio = file.mimeType.startsWith('audio');

    return (
      <TouchableOpacity
        key={file.id}
        onPress={() => onMediaPress(mediaFiles, index)}
        style={{
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: '#f3f4f6',
        }}
      >
        {isImage && (
          <Image
            source={{ uri: `${API_URL}/media/chat/${file.fileName}` }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        )}
        
        {isVideo && (
          <VideoThumbnail 
            fileName={file.fileName}
            size={size}
          />
        )}
        
        {isAudio && (
          <View style={{
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#e5e7eb',
          }}>
            <View style={{
              width: size * 0.4,
              height: size * 0.4,
              backgroundColor: '#8b5cf6',
              borderRadius: size * 0.2,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="musical-notes" size={size * 0.2} color="white" />
            </View>
          </View>
        )}

        {/* Video play overlay */}
        {isVideo && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}>
            <View style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 25,
              width: 50,
              height: 50,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="play" size={25} color="white" />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMediaGrid = () => {
    if (loading) {
      return (
        <View style={{
          width: containerWidth,
          height: 140,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius,
          marginVertical: 4,
        }}>
          <ActivityIndicator size="small" color="#6b7280" />
          <Text style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
            Loading media...
          </Text>
        </View>
      );
    }

    if (error || mediaFiles.length === 0) {
      return (
        <View style={{
          width: containerWidth,
          height: 140,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius,
          borderWidth: 1,
          borderColor: '#d1d5db',
          borderStyle: 'dashed',
          marginVertical: 4,
        }}>
          <Ionicons name="image-outline" size={32} color="#9ca3af" />
          <Text style={{ marginTop: 4, fontSize: 12, color: '#9ca3af' }}>
            No media files
          </Text>
        </View>
      );
    }

    const fileCount = mediaFiles.length;

    // Single file - full width, square aspect ratio
    if (fileCount === 1) {
      return (
        <View style={{ marginVertical: 4 }}>
          <TouchableOpacity
            onPress={() => onMediaPress(mediaFiles, 0)}
            style={{
              width: containerWidth,
              height: containerWidth,
              borderRadius,
              overflow: 'hidden',
              backgroundColor: '#f3f4f6',
            }}
          >
            {renderMediaItem(mediaFiles[0], 0, containerWidth, borderRadius)}
          </TouchableOpacity>
        </View>
      );
    }

    // Two files - side by side
    if (fileCount === 2) {
      return (
        <View style={{ marginVertical: 4 }}>
          <View style={{
            width: containerWidth,
            height: itemSize,
            flexDirection: 'row',
            gap: 3,
          }}>
            {mediaFiles.map((file, index) => (
              <View key={file.id} style={{ width: itemSize, height: itemSize }}>
                {renderMediaItem(file, index, itemSize, borderRadius)}
              </View>
            ))}
          </View>
        </View>
      );
    }

    // Three files - left column: 1 file, right column: 2 files stacked
    if (fileCount === 3) {
      return (
        <View style={{ marginVertical: 4 }}>
          <View style={{
            width: containerWidth,
            height: itemSize * 2 + 3, // Height for 2 rows with gap
            flexDirection: 'row',
            gap: 3,
          }}>
            {/* Left column - 1 file */}
            <View style={{ width: itemSize }}>
              {renderMediaItem(mediaFiles[0], 0, itemSize, borderRadius)}
            </View>
            
            {/* Right column - 2 files stacked */}
            <View style={{ width: itemSize, gap: 3 }}>
              {mediaFiles.slice(1, 3).map((file, index) => (
                <View key={file.id} style={{ height: itemSize }}>
                  {renderMediaItem(file, index + 1, itemSize, borderRadius)}
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // Four files - 2x2 grid
    if (fileCount === 4) {
      return (
        <View style={{ marginVertical: 4 }}>
          <View style={{
            width: containerWidth,
            height: itemSize * 2 + 3, // Height for 2 rows with gap
            gap: 3,
          }}>
            {/* Top row */}
            <View style={{ flexDirection: 'row', gap: 3, height: itemSize }}>
              {mediaFiles.slice(0, 2).map((file, index) => (
                <View key={file.id} style={{ width: itemSize }}>
                  {renderMediaItem(file, index, itemSize, borderRadius)}
                </View>
              ))}
            </View>
            {/* Bottom row */}
            <View style={{ flexDirection: 'row', gap: 3, height: itemSize }}>
              {mediaFiles.slice(2, 4).map((file, index) => (
                <View key={file.id} style={{ width: itemSize }}>
                  {renderMediaItem(file, index + 2, itemSize, borderRadius)}
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // Five or more files - 2x2 grid with +N overlay on bottom right
    const visibleFiles = mediaFiles.slice(0, 3); // Show first 3 files in 2x2 grid
    const remainingCount = fileCount - 3;

    return (
      <View style={{ marginVertical: 4 }}>
        <View style={{
          width: containerWidth,
          height: itemSize * 2 + 3, // Height for 2 rows with gap
          gap: 3,
        }}>
          {/* Top row */}
          <View style={{ flexDirection: 'row', gap: 3, height: itemSize }}>
            {visibleFiles.slice(0, 2).map((file, index) => (
              <View key={file.id} style={{ width: itemSize }}>
                {renderMediaItem(file, index, itemSize, borderRadius)}
              </View>
            ))}
          </View>
          {/* Bottom row */}
          <View style={{ flexDirection: 'row', gap: 3, height: itemSize }}>
            <View style={{ width: itemSize }}>
              {renderMediaItem(visibleFiles[2], 2, itemSize, borderRadius)}
            </View>
            {/* +N overlay */}
            <View style={{ width: itemSize, height: itemSize, position: 'relative' }}>
              {/* Background for overlay */}
              <View style={{
                width: itemSize,
                height: itemSize,
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderRadius,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: 20,
                  fontWeight: 'bold',
                }}>
                  +{remainingCount}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View>
      {renderMediaGrid()}
    </View>
  );
};

// Video thumbnail component
const VideoThumbnail: React.FC<{ fileName: string; size: number }> = ({ fileName, size }) => {
  const videoUrl = `${API_URL}/media/chat/${fileName}`;
  
  const videoPlayer = useVideoPlayer(videoUrl, player => {
    if (player) {
      player.loop = false;
      player.muted = true;
      player.pause();
    }
  });

  return (
    <View style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <VideoView
        style={{ width: '100%', height: '100%' }}
        player={videoPlayer}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        showsTimecodes={false}
        requiresLinearPlayback={true}
      />
    </View>
  );
};

export default MediaGrid;
