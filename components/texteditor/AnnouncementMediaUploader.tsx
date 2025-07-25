import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import { useEvent } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

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
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<AnnouncementMediaFile | null>(null);

  // Video player for selected video
  const videoPlayer = useVideoPlayer(
    selectedFile?.mimeType.startsWith("video") && announcementId
      ? `${API_URL}/media/announcement/${announcementId}/media/${selectedFile.fileName}` 
      : null,
    player => {
      if (player) {
        player.loop = false;
      }
    }
  );

  // Video player state
  const { isPlaying } = useEvent(videoPlayer, 'playingChange', { 
    isPlaying: videoPlayer.playing 
  });

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
          Alert.alert('Success', 'Media files uploaded successfully!');
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
      Alert.alert('Success', 'Media file removed successfully!');
    } catch (error) {
      console.error("Error removing file:", error);
      Alert.alert("Error", "Failed to remove file");
    }
  };

  const openFileModal = (file: AnnouncementMediaFile) => {
    setSelectedFile(file);
    if (file.mimeType.startsWith("image")) {
      setImageModalVisible(true);
    } else if (file.mimeType.startsWith("video")) {
      setVideoModalVisible(true);
    } else if (file.mimeType.startsWith("audio")) {
      setAudioModalVisible(true);
    }
  };

  return (
    <View className="mb-6">
      <Text className="text-lg font-semibold text-gray-900 mb-3">Attach Media Files</Text>
      
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
          <View className="flex-row flex-wrap gap-2">
            {mediaFiles.map((file, index) => (
              <MediaThumbnail 
                key={index} 
                file={file} 
                onPress={() => openFileModal(file)}
                onRemove={() => removeFile(file)}
                announcementId={announcementId}
              />
            ))}
          </View>
        </View>
      )}

      {/* Video Modal */}
      <Modal
        visible={videoModalVisible}
        animationType="slide"
        onRequestClose={() => setVideoModalVisible(false)}
      >
        <View style={styles.videoModal}>
          <View style={styles.videoHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setVideoModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedFile && selectedFile.mimeType.startsWith("video") && (
            <View style={styles.videoContainer}>
              <VideoView
                style={styles.video}
                player={videoPlayer}
                allowsFullscreen
                allowsPictureInPicture
              />
              <View style={styles.videoControls}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => {
                    if (isPlaying) {
                      videoPlayer.pause();
                    } else {
                      videoPlayer.play();
                    }
                  }}
                >
                  <Text style={styles.playButtonText}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModal}>
          <View style={styles.imageHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setImageModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedFile && (
            <ScrollView
              style={styles.imageScrollView}
              contentContainerStyle={styles.imageContainer}
              maximumZoomScale={3}
              minimumZoomScale={1}
            >
              <Image
                source={{
                  uri: `${API_URL}/media/announcement/${announcementId}/media/${selectedFile.fileName}`
                }}
                style={styles.image}
                resizeMode="contain"
                onError={() => {
                  console.error("Image load error for file:", selectedFile.fileName);
                  Alert.alert("Error", "Failed to load image");
                }}
              />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Audio Modal */}
      <Modal
        visible={audioModalVisible}
        animationType="slide"
        onRequestClose={() => setAudioModalVisible(false)}
      >
        <View style={styles.audioModal}>
          <View style={styles.audioHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setAudioModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          
          {selectedFile && (
            <View style={styles.audioPlayer}>
              <Text style={styles.audioTitle}>🎵 {selectedFile.originalName}</Text>
              <Text style={styles.audioSubtitle}>Audio file - {formatBytes(selectedFile.size)}</Text>
              
              <View style={styles.audioControls}>
                <Text style={styles.audioNote}>
                  Audio playback requires installing react-native-sound package.
                </Text>
                <Text style={styles.audioInstructions}>
                  Run: npm install react-native-sound
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const MediaThumbnail = ({ 
  file, 
  onPress, 
  onRemove, 
  announcementId 
}: { 
  file: AnnouncementMediaFile; 
  onPress: () => void;
  onRemove: () => void;
  announcementId: number;
}) => {
  const isImage = file.mimeType.startsWith("image");
  const isAudio = file.mimeType.startsWith("audio");
  const isVideo = file.mimeType.startsWith("video");

  return (
    <View className="w-20 h-20 rounded-lg overflow-hidden justify-center items-center relative bg-gray-100">
      <TouchableOpacity className="w-full h-full" onPress={onPress}>
        {isImage && (
          <Image 
            source={{ 
              uri: `${API_URL}/media/announcement/${announcementId}/media/${file.fileName}`,
            }} 
            className="w-full h-full" 
            resizeMode="cover"
            onError={() => {
              console.error("Thumbnail load error for:", file.fileName);
            }}
          />
        )}
        {isAudio && (
          <View className="w-full h-full bg-purple-500 justify-center items-center">
            <Text className="text-lg mb-1">🎵</Text>
            <Text className="text-white text-xs text-center px-1" numberOfLines={1}>
              {file.originalName}
            </Text>
          </View>
        )}
        {isVideo && (
          <View className="w-full h-full bg-red-500 justify-center items-center">
            <Text className="text-lg mb-1">🎬</Text>
            <Text className="text-white text-xs text-center px-1" numberOfLines={1}>
              {file.originalName}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        className="absolute top-1 right-1 bg-red-500 rounded-full w-5 h-5 justify-center items-center"
        onPress={onRemove}
      >
        <Text className="text-white text-xs font-bold">×</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Video Modal Styles
  videoModal: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 50,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '80%',
  },
  videoControls: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
  playButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 25,
  },
  playButtonText: {
    fontSize: 24,
    color: 'white',
  },

  // Image Modal Styles
  imageModal: {
    flex: 1,
    backgroundColor: 'black',
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 50,
  },
  imageScrollView: {
    flex: 1,
  },
  imageContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },

  // Audio Modal Styles
  audioModal: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 50,
  },
  audioPlayer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  audioTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  audioSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  audioNote: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  audioInstructions: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginTop: 10,
  },
  audioControls: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    justifyContent: 'center',
  },

  // Common Styles
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
}); 