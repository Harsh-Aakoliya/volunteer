import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from "expo-video";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import axios from "axios";
import ImageViewer from '@/components/texteditor/ImageViewer';
import VideoViewer from '@/components/texteditor/VideoViewer';
import AudioViewer from '@/components/texteditor/AudioViewer';

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
  mediaId: number;
}

export default function MediaViewerModal({ visible, onClose, mediaId }: MediaViewerModalProps) {
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Media viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<MediaFile | null>(null);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<MediaFile | null>(null);
  const [audioViewerVisible, setAudioViewerVisible] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<MediaFile | null>(null);

  // Fetch media data when modal opens
  useEffect(() => {
    if (visible && mediaId) {
      fetchMediaData();
    }
  }, [visible, mediaId]);

  // Reset viewer states when modal closes
  useEffect(() => {
    if (!visible) {
      setImageViewerVisible(false);
      setVideoViewerVisible(false);
      setAudioViewerVisible(false);
      setSelectedImageFile(null);
      setSelectedVideoFile(null);
      setSelectedAudioFile(null);
    }
  }, [visible]);

  // Media file click handlers
  const handleImageClick = (file: MediaFile) => {
    setSelectedImageFile(file);
    setImageViewerVisible(true);
  };

  const handleVideoClick = (file: MediaFile) => {
    setSelectedVideoFile(file);
    setVideoViewerVisible(true);
  };

  const handleAudioClick = (file: MediaFile) => {
    setSelectedAudioFile(file);
    setAudioViewerVisible(true);
  };

  const fetchMediaData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AuthStorage.getToken();
      console.log(`Fetching media data for ID: ${mediaId}`);
      
      const response = await axios.get(
        `${API_URL}/api/vm-media/media/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setMediaData(response.data.media);
        console.log(`Loaded ${response.data.media.files.length} files`);
      } else {
        setError("Failed to load media files");
      }
    } catch (error: any) {
      console.error("Error fetching media:", error);
      setError(error.response?.data?.error || "Failed to load media files");
    } finally {
      setLoading(false);
    }
  };

  // Render media grid items
  const renderMediaItem = ({ item, index }: { item: MediaFile; index: number }) => {
    const isImage = item.mimeType.startsWith('image/');
    const isVideo = item.mimeType.startsWith('video/');
    const isAudio = item.mimeType.startsWith('audio/');

    if (isImage) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => handleImageClick(item)}
          className="bg-white p-1 rounded-lg mb-3 border border-gray-200 shadow-sm"
        >
          <Image
            source={{ uri: `${API_URL}/media/chat/${item.url}` }}
            style={{ 
              width: '100%', 
              aspectRatio: 1,
              alignSelf: 'center'
            }}
            className="rounded-lg"
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    } else if (isVideo) {
      return <VideoPreviewItem key={index} file={item} onPress={() => handleVideoClick(item)} />;
    } else if (isAudio) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => handleAudioClick(item)}
          className="flex-row items-center bg-white p-3 rounded-lg mb-3 border border-gray-200 shadow-sm"
        >
          <View className="w-16 h-16 bg-purple-100 rounded-lg mr-3 items-center justify-center">
            <Ionicons name="musical-notes" size={32} color="#8b5cf6" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900">{item.originalName}</Text>
            <Text className="text-sm text-gray-600">Audio file • Tap to play</Text>
          </View>
          <View className="items-center justify-center">
            <Ionicons name="play-circle" size={32} color="#8b5cf6" />
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  };



  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={onClose}
      >
        <SafeAreaView className="flex-1 bg-white">
          {/* Header */}
          <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
            <Text className="text-xl font-bold">Media Files</Text>
            <TouchableOpacity
              className="p-2"
              onPress={onClose}
            >
              <Ionicons name="close" size={28} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0284c7" />
              <Text className="text-gray-600 mt-4">Loading media files...</Text>
            </View>
          ) : error ? (
            <View className="flex-1 justify-center items-center p-4">
              <Text className="text-red-600 text-center mb-4">⚠️ {error}</Text>
              <TouchableOpacity 
                className="bg-blue-500 px-4 py-2 rounded-lg"
                onPress={fetchMediaData}
              >
                <Text className="text-white font-bold">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : mediaData ? (
                        <ScrollView className="flex-1 p-4">
              {mediaData.files.map((file, index) => renderMediaItem({ item: file, index }))}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Individual Media Viewers */}
      {selectedImageFile && (
        <ImageViewer
          visible={imageViewerVisible}
          imageUri={`${API_URL}/media/chat/${selectedImageFile.url}`}
          onClose={() => {
            setImageViewerVisible(false);
            setSelectedImageFile(null);
          }}
          title={selectedImageFile.originalName}
        />
      )}

      {selectedVideoFile && (
        <VideoViewer
          visible={videoViewerVisible}
          videoUri={`${API_URL}/media/chat/${selectedVideoFile.url}`}
          onClose={() => {
            setVideoViewerVisible(false);
            setSelectedVideoFile(null);
          }}
          title={selectedVideoFile.originalName}
        />
      )}

      {selectedAudioFile && (
        <AudioViewer
          visible={audioViewerVisible}
          audioUri={`${API_URL}/media/chat/${selectedAudioFile.url}`}
          onClose={() => {
            setAudioViewerVisible(false);
            setSelectedAudioFile(null);
          }}
          title={selectedAudioFile.originalName}
          size={selectedAudioFile.size}
        />
      )}
    </>
  );
}

// Video preview component
interface VideoPreviewItemProps {
  file: MediaFile;
  onPress: () => void;
}

const VideoPreviewItem: React.FC<VideoPreviewItemProps> = ({ file, onPress }) => {
  const videoUrl = `${API_URL}/media/chat/${file.url}`;
  
  // Create video player for preview (paused, no controls)
  const previewVideoPlayer = useVideoPlayer(videoUrl, player => {
    if (player) {
      player.loop = false;
      player.muted = true; // Mute the preview
      player.pause(); // Don't autoplay
    }
  });

  return (
    <TouchableOpacity
      className="bg-white p-1 rounded-lg mb-3 border border-gray-200 shadow-sm"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="relative">
        {/* Video preview as background */}
        <VideoView
          style={{ 
            width: '100%', 
            height: 200, 
            borderRadius: 8,
          }}
          player={previewVideoPlayer}
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          showsTimecodes={false}
          requiresLinearPlayback={true}
        />
        
        {/* Play overlay on top of video */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent overlay
          borderRadius: 8,
        }}>
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 50,
            width: 80,
            height: 80,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="play" size={40} color="white" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}; 