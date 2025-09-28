import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  Dimensions,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import ImageViewer from './ImageViewer';
import VideoViewer from './VideoViewer';
import AudioViewer from './AudioViewer';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

type AnnouncementMediaFile = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
};

type UploadingFile = {
  name: string;
  size: number;
  progress: number;
  mimeType: string;
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface AnnouncementMediaUploaderProps {
  announcementId: number;
  onMediaChange?: (files: AnnouncementMediaFile[]) => void;
}

export default function AnnouncementMediaUploader({ 
  announcementId, 
  onMediaChange 
}: AnnouncementMediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<AnnouncementMediaFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  // Modal states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [audioViewerVisible, setAudioViewerVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<AnnouncementMediaFile | null>(null);

  // Screen dimensions for grid layout
  const screenWidth = Dimensions.get('window').width;
  const mediaItemWidth = (screenWidth - 48) / 2;



  // Load existing media files on component mount
  useEffect(() => {
    loadExistingMediaFiles();
  }, [announcementId]);

  // Notify parent component when media files change
  useEffect(() => {
    if (onMediaChange) {
      onMediaChange(mediaFiles);
    }
  }, [mediaFiles, onMediaChange]);

  const loadExistingMediaFiles = async () => {
    try {
      const token = await AuthStorage.getToken();
      const response = await axios.get(
        `${API_URL}/api/announcements/${announcementId}/media`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setMediaFiles(response.data.files || []);
      }
    } catch (error) {
      console.log("No existing media files or error loading them:", error);
      // Don't show error alert as it's normal for announcements to have no media
    }
  };

  const handleSelectFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: ["image/*", "audio/*", "video/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      setUploading(true);
      const filesToUpload: UploadingFile[] = result.assets.map((asset: any) => ({
        name: asset.name,
        size: asset.size || 0,
        progress: 0,
        mimeType: asset.mimeType || "",
      }));
      setUploadingFiles(filesToUpload);

      const filesWithData = await Promise.all(
        result.assets.map(async (asset: any) => {
          if (Platform.OS === "web") {
            const file = asset.file ?? (asset as any);
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result?.toString().split(",")[1] || "");
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            return {
              name: asset.name,
              mimeType: asset.mimeType || "application/octet-stream",
              fileData: base64,
            };
          } else {
            const fileData = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            return {
              name: asset.name,
              mimeType: asset.mimeType || "application/octet-stream",
              fileData,
            };
          }
        })
      );

      try {
        const token = await AuthStorage.getToken();
        const response = await axios.post(
          `${API_URL}/api/announcements/${announcementId}/media/upload`,
          {
            files: filesWithData,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          setMediaFiles((prev) => [...prev, ...response.data.uploadedFiles]);
        }

        setTimeout(() => setUploadingFiles([]), 1000);
      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Upload failed", "There was an error uploading your files.");
      } finally {
        setUploading(false);
      }
    } catch (error) {
      console.error("File selection error:", error);
      setUploading(false);
    }
  };

  const removeFile = async (file: AnnouncementMediaFile) => {
    try {
      const token = await AuthStorage.getToken();
      await axios.delete(
        `${API_URL}/api/announcements/${announcementId}/media/${file.fileName}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setMediaFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (error) {
      console.error("Error removing file:", error);
      Alert.alert("Error", "Failed to remove file");
    }
  };

  const renderMediaGrid = () => {
    if (mediaFiles.length === 0) {
      return null;
    }

    const rows = [];
    for (let i = 0; i < mediaFiles.length; i += 2) {
      const leftFile = mediaFiles[i];
      const rightFile = mediaFiles[i + 1];
      
      rows.push(
        <View key={i} className="flex-row justify-between mb-4">
          <View style={{ width: mediaItemWidth }}>
            <MediaThumbnail 
              file={leftFile} 
              onPress={() => openFileModal(leftFile)}
              onRemove={() => removeFile(leftFile)}
              announcementId={announcementId}
              width={mediaItemWidth}
            />
          </View>
          
          {rightFile ? (
            <View style={{ width: mediaItemWidth }}>
              <MediaThumbnail 
                file={rightFile} 
                onPress={() => openFileModal(rightFile)}
                onRemove={() => removeFile(rightFile)}
                announcementId={announcementId}
                width={mediaItemWidth}
              />
            </View>
          ) : (
            <View style={{ width: mediaItemWidth }} />
          )}
        </View>
      );
    }
    
    return <View>{rows}</View>;
  };

  const openFileModal = (file: AnnouncementMediaFile) => {
    setSelectedFile(file);
    if (file.mimeType.startsWith("image")) {
      setImageViewerVisible(true);
    } else if (file.mimeType.startsWith("video")) {
      setVideoViewerVisible(true);
    } else if (file.mimeType.startsWith("audio")) {
      setAudioViewerVisible(true);
    }
  };

  return (
    <View className="mb-6">
      
      <TouchableOpacity 
        onPress={handleSelectFiles}
        className={`py-3 px-4 rounded-lg mb-4 border-2 border-dashed ${uploading ? 'border-gray-300 bg-gray-100' : 'border-blue-300 bg-blue-50'}`}
        disabled={uploading}
      >
        <Text className={`font-semibold text-center ${uploading ? 'text-gray-500' : 'text-blue-600'}`}>
          {uploading ? "Uploading..." : "📎 Select Media Files"}
        </Text>
      </TouchableOpacity>
      
      {uploadingFiles.length > 0 && (
        <View className="mb-4">
          <Text className="text-sm font-semibold mb-2 text-gray-700">Upload Progress</Text>
          {uploadingFiles.map((file, index) => (
            <View key={index} className="mb-2">
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs text-gray-600" numberOfLines={1}>{file.name}</Text>
                <Text className="text-xs text-blue-600">{formatBytes(file.size)}</Text>
              </View>
              <View className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <View className="h-full bg-blue-500 w-full" />
              </View>
            </View>
          ))}
        </View>
      )}

      {mediaFiles.length > 0 && (
        <View>
          <Text className="text-sm font-semibold mb-2 text-gray-700">
            Attached Files ({mediaFiles.length})
          </Text>
          {renderMediaGrid()}
        </View>
      )}

      {/* Media Viewers */}
      {selectedFile && (
        <>
          <ImageViewer
            visible={imageViewerVisible}
            imageUri={`${API_URL}/media/announcement/${announcementId}/media/${selectedFile.fileName}`}
            onClose={() => {
              setImageViewerVisible(false);
              setSelectedFile(null);
            }}
            title={selectedFile.originalName || selectedFile.fileName}
          />
          
          <VideoViewer
            visible={videoViewerVisible}
            videoUri={`${API_URL}/media/announcement/${announcementId}/media/${selectedFile.fileName}`}
            onClose={() => {
              setVideoViewerVisible(false);
              setSelectedFile(null);
            }}
            title={selectedFile.originalName || selectedFile.fileName}
          />
          
          <AudioViewer
            visible={audioViewerVisible}
            audioUri={`${API_URL}/media/announcement/${announcementId}/media/${selectedFile.fileName}`}
            onClose={() => {
              setAudioViewerVisible(false);
              setSelectedFile(null);
            }}
            title={selectedFile.originalName || selectedFile.fileName}
            size={selectedFile.size}
          />
        </>
      )}
    </View>
  );
}

const MediaThumbnail = ({ 
  file, 
  onPress, 
  onRemove, 
  announcementId,
  width
}: { 
  file: AnnouncementMediaFile; 
  onPress: () => void;
  onRemove: () => void;
  announcementId: number;
  width: number;
}) => {
  const isImage = file.mimeType.startsWith("image");
  const isAudio = file.mimeType.startsWith("audio");
  const isVideo = file.mimeType.startsWith("video");

  return (
    <View className="relative">
      <TouchableOpacity
        onPress={onPress}
        className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
        style={{ height: width }}
      >
        {isImage && (
          <Image
            source={{ uri: `${API_URL}/media/announcement/${announcementId}/media/${file.fileName}` }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => {
              console.error("Thumbnail load error for:", file.fileName);
            }}
          />
        )}
        {isVideo && (
          <VideoThumbnailUploader 
            file={file} 
            announcementId={announcementId} 
            width={width} 
          />
        )}
        {isAudio && (
          <View className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden items-center justify-center" style={{ height: width }}>
            <View className="w-24 h-24 bg-purple-500 rounded-full justify-center items-center mb-5">
              <Text className="text-4xl">🎵</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        className="absolute top-2 right-2 bg-red-500 rounded-full w-6 h-6 justify-center items-center z-10"
        onPress={onRemove}
      >
        <Ionicons name="close" size={16} color="white" />
      </TouchableOpacity>
    </View>
  );
};

// Video thumbnail component for uploader
const VideoThumbnailUploader: React.FC<{ file: any; announcementId: number; width: number }> = ({ 
  file, 
  announcementId, 
  width 
}) => {
  const videoUrl = `${API_URL}/media/announcement/${announcementId}/media/${file.fileName}`;
  
  // Create video player for preview (paused, no controls)
  const previewVideoPlayer = useVideoPlayer(videoUrl, player => {
    if (player) {
      player.loop = false;
      player.muted = true;
      player.pause();
    }
  });

  return (
    <View className="relative" style={{ height: width }}>
      {/* Video preview as background */}
      <VideoView
        style={{ 
          width: '100%', 
          height: '100%',
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
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
      }}>
        <View style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: 50,
          width: 50,
          height: 50,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Ionicons name="play" size={25} color="white" />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({}); 