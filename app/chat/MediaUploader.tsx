// app/chat/MediaUploader.tsx
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
// import Sound from "react-native-sound"; // Package removed to reduce build size
import { API_URL } from "@/constants/api";
import { TextInput } from "react-native";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

type VMMediaFile = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  caption: string;
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

const formatDuration = (millis: number) => {
  if (!millis) return '0:00';
  const minutes = Math.floor(millis / 60000);
  const seconds = Math.floor((millis % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function MediaUploadApp() {
  const { roomId, userId, vmMedia } = useLocalSearchParams();
  const navigation = useNavigation();
  const isVmMedia = vmMedia === 'true';
  
  const [uploading, setUploading] = useState(false);
  const [vmMediaFiles, setVmMediaFiles] = useState<VMMediaFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [tempFolderId, setTempFolderId] = useState<string>("");
  const [isSuccessfullySent, setIsSuccessfullySent] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<any>({});

  // Modal states
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VMMediaFile | null>(null);
  
  // Audio player state
  const [audioSound, setAudioSound] = useState<any>(null); // Changed to any as react-native-sound is removed
  const [audioStatus, setAudioStatus] = useState<any>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Video player for selected video
  const videoPlayer = useVideoPlayer(
    selectedFile?.mimeType.startsWith("video") && tempFolderId
      ? `${API_URL}/media/chat/temp_${tempFolderId}/${selectedFile.fileName}` 
      : null,
    player => {
      if (player) {
        player.loop = false; // Don't loop by default in preview
        // Don't autoplay in preview modal
      }
    }
  );

  // Video player state
  const { isPlaying } = useEvent(videoPlayer, 'playingChange', { 
    isPlaying: videoPlayer.playing 
  });

  // Get auth headers on component mount
  useEffect(() => {
    const getAuthHeaders = async () => {
      try {
        const token = await AuthStorage.getToken();
        setAuthHeaders({
          'Authorization': `Bearer ${token}`
        });
      } catch (error) {
        console.error("Error getting auth token:", error);
      }
    };
    getAuthHeaders();
  }, []);

  // Helper function to get direct image source
  const getDirectImageSource = (fileName: string) => {
    return {
      uri: `${API_URL}/media/chat/temp_${tempFolderId}/${fileName}`
    };
  };

  // Audio player functions
  const loadAudio = async (audioUrl: string) => {
    try {
      // Unload previous audio if exists
      if (audioSound) {
        // No direct equivalent to Audio.setAudioModeAsync for react-native-sound
        // This might need to be handled differently depending on your app's audio requirements
        // For now, we'll just load the audio
      }

      // Placeholder for audio loading logic
      console.log("Loading audio from:", audioUrl);
      // In a real app, you would use a library like react-native-sound or a custom audio player
      // For now, we'll just set status to loaded and not playing
      setAudioStatus({ isLoaded: true, isPlaying: false, durationMillis: 0, positionMillis: 0 });
      
    } catch (error) {
      console.error("Error loading audio:", error);
      Alert.alert("Error", "Failed to load audio file");
    }
  };

  const toggleAudioPlayback = async () => {
    if (!audioSound) return;
    
    try {
      if (isAudioPlaying) {
        // No direct equivalent to Audio.pauseAsync for react-native-sound
        // This might need to be handled differently depending on your app's audio requirements
        console.log("Pausing audio playback (placeholder)");
      } else {
        // No direct equivalent to Audio.playAsync for react-native-sound
        // This might need to be handled differently depending on your app's audio requirements
        console.log("Playing audio playback (placeholder)");
      }
    } catch (error) {
      console.error("Error toggling audio playback:", error);
    }
  };

  const formatAudioTime = (millis: number) => {
    if (!millis) return '0:00';
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Load audio when audio modal opens
  useEffect(() => {
    if (audioModalVisible && selectedFile?.mimeType.startsWith("audio")) {
      // Configure audio session
      const configureAudioSession = async () => {
        try {
          // No direct equivalent to Audio.setAudioModeAsync for react-native-sound
          // This might need to be handled differently depending on your app's audio requirements
          // For now, we'll just load the audio
        } catch (error) {
          console.error("Error configuring audio session:", error);
        }
      };
      
      configureAudioSession().then(() => {
        loadAudio(selectedFile.url);
      });
    } else {
      // Clean up audio when modal closes
      if (audioSound) {
        // No direct equivalent to Audio.stopAsync or Audio.release for react-native-sound
        // This might need to be handled differently depending on your app's audio requirements
        console.log("Cleaning up audio (placeholder)");
        setAudioSound(null);
        setAudioStatus(null);
        setIsAudioPlaying(false);
      }
    }
  }, [audioModalVisible, selectedFile]);

  // console.log("selectedFile", selectedFile);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If successfully sent or no files, allow navigation without alert
      if (isSuccessfullySent || vmMediaFiles.length === 0) {
        navigation.dispatch(e.data.action);
        return;
      }
      
      // Prevent default behavior and show alert only if files exist and not sent
      e.preventDefault();
      Alert.alert(
        'Discard media?',
        'You have uploaded media files. What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard and Exit',
            style: 'destructive',
            onPress: async () => {
              await handleDiscardAndExit();
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, vmMediaFiles.length, tempFolderId, isSuccessfullySent]);

  const handleDiscardAndExit = async () => {
    if (tempFolderId) {
      try {
        const token = await AuthStorage.getToken();
        await axios.delete(`${API_URL}/api/vm-media/temp/${tempFolderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error("Error deleting temp folder:", error);
      }
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
  
      // console.log("file with data", filesWithData);
  
      try {
        const token = await AuthStorage.getToken();
        const response = await axios.post(
          `${API_URL}/api/vm-media/upload`,
          {
            files: filesWithData,
            tempFolderId: tempFolderId || undefined,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("response got after upload",response.data);
  
        if (response.data.success) {
          setTempFolderId(response.data.tempFolderId);
          setVmMediaFiles((prev) => [...prev, ...response.data.uploadedFiles]);
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

  const removeFile = async (file: VMMediaFile) => {
    try {
      const token = await AuthStorage.getToken();
      await axios.delete(`${API_URL}/api/vm-media/temp/${tempFolderId}/${file.fileName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVmMediaFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (error) {
      console.error("Error removing file:", error);
      Alert.alert("Error", "Failed to remove file");
    }
  };

  const sendToChat = async () => {
    if (vmMediaFiles.length === 0) return;
    
    setSending(true);
    try {
      const token = await AuthStorage.getToken();
      
      // Prepare files with captions in the format expected by backend
      const filesWithCaptions = vmMediaFiles.map(f => ({
        fileName: f.fileName,
        originalName: f.originalName,
        caption: f.caption || "",
        mimeType: f.mimeType,
        size: f.size
      }));
      
      const response = await axios.post(
        `${API_URL}/api/vm-media/move-to-chat`,
        {
          tempFolderId,
          roomId,
          senderId: userId, // backend expects senderId, not userId
          filesWithCaptions // backend expects filesWithCaptions, not files
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setIsSuccessfullySent(true);
        Alert.alert("Success", "Media sent to chat successfully!", [
          { text: "OK", onPress: () => router.back() }
        ]);
      }
    } catch (error:any) {
      console.error("Error sending to chat:", error);
      const errorMessage = error.response?.data?.error || error.message || "Failed to send media to chat";
      Alert.alert("Error", errorMessage);
    } finally {
      setSending(false);
    }
  };

  const openFileModal = (file: VMMediaFile) => {
    setSelectedFile(file);
    console.log("Opening file:", file.url); // Debug log
    if (file.mimeType.startsWith("image")) {
      setImageModalVisible(true);
    } else if (file.mimeType.startsWith("video")) {
      setVideoModalVisible(true);
    } else if (file.mimeType.startsWith("audio")) {
      setAudioModalVisible(true);
    }
  };

  // If not VM media, show message about old flow
  if (!isVmMedia) {
    return (
      <View className="flex-1 bg-white justify-center items-center p-5">
        <Text className="text-2xl font-bold mb-5 text-center">Media Uploader</Text>
        <Text className="text-lg text-gray-600 text-center mb-4">
          This is the old Google Drive media upload flow.
        </Text>
        <Text className="text-md text-gray-500 text-center mb-6">
          Please use "VM Media" for the new server-side storage.
        </Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="bg-blue-500 py-3 px-6 rounded-lg"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 p-5">
        <Text className="text-2xl font-bold mb-5">VM Media Uploader</Text>
        
        <TouchableOpacity 
          onPress={handleSelectFiles}
          className={`py-3 px-4 rounded-lg mb-5 ${uploading ? 'bg-gray-400' : 'bg-blue-500'}`}
          disabled={uploading}
        >
          <Text className="text-white font-semibold text-center">
            {uploading ? "Uploading..." : "Select & Upload Files"}
          </Text>
        </TouchableOpacity>
        
        {uploadingFiles.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">Upload Progress</Text>
            {uploadingFiles.map((file, index) => (
              <View key={index} className="mb-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm" numberOfLines={1}>{file.name}</Text>
                  <Text className="text-sm text-blue-600">{formatBytes(file.size)}</Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View className="h-full bg-blue-500 w-full" />
                </View>
              </View>
            ))}
          </View>
        )}

        <Text className="text-lg font-semibold mb-2">
          {vmMediaFiles.length > 0 ? 'Uploaded Files' : 'No files uploaded yet'}
        </Text>
        
        <View className="flex-row flex-wrap gap-2">
          {vmMediaFiles.map((file, index) => (
            <VMMediaThumbnail 
              key={index} 
              file={file} 
              onPress={() => openFileModal(file)}
              onRemove={() => removeFile(file)}
              tempFolderId={tempFolderId}
            />
          ))}
        </View>

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
              <>
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
                <View style={styles.captionContainer}>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add caption to this video..."
                    onChangeText={(text) => setVmMediaFiles((prev: VMMediaFile[]) => 
                      prev.map((f: VMMediaFile) => f.id === selectedFile.id ? {...f, caption: text} : f)
                    )}
                    multiline={true}
                    value={vmMediaFiles.find(f => f.id === selectedFile.id)?.caption || ''}
                  />
                </View>
              </>
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
              <>
                <ScrollView
                  style={styles.imageScrollView}
                  contentContainerStyle={styles.imageContainer}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                >
                  <Image
                    source={getDirectImageSource(selectedFile.fileName)}
                    style={styles.image}
                    resizeMode="contain"
                    onError={() => {
                      console.error("Image load error for file:", selectedFile.fileName);
                      Alert.alert("Error", "Failed to load image");
                    }}
                    onLoad={() => console.log("Image loaded successfully")}
                  />
                </ScrollView>
                <View style={styles.captionContainer}>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add caption to this image..."
                    onChangeText={(text) => setVmMediaFiles((prev: VMMediaFile[]) => 
                      prev.map((f: VMMediaFile) => f.id === selectedFile.id ? {...f, caption: text} : f)
                    )}
                    multiline={true}
                    value={vmMediaFiles.find(f => f.id === selectedFile.id)?.caption || ''}
                  />
                </View>
              </>
            )}
          </View>
        </Modal>

        {/* Audio Modal - Placeholder for react-native-sound */}
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
              <>
                <View style={styles.audioPlayer}>
                  <Text style={styles.audioTitle}>🎵 {selectedFile.originalName}</Text>
                  <Text style={styles.audioSubtitle}>Audio file - {formatBytes(selectedFile.size)}</Text>
                  
                  {/* Audio Controls Placeholder */}
                  <View style={styles.audioControls}>
                    <Text style={styles.audioNote}>
                      Audio playback requires installing react-native-sound package.
                    </Text>
                    <Text style={styles.audioInstructions}>
                      Run: npm install react-native-sound
                    </Text>
                  </View>
                </View>
                <View style={styles.captionContainer}>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add caption to this audio..."
                    onChangeText={(text) => setVmMediaFiles((prev: VMMediaFile[]) => 
                      prev.map((f: VMMediaFile) => f.id === selectedFile.id ? {...f, caption: text} : f)
                    )}
                    multiline={true}
                    value={vmMediaFiles.find(f => f.id === selectedFile.id)?.caption || ''}
                  />
                </View>
              </>
            )}
          </View>
        </Modal>
        
        <TouchableOpacity
          className={`py-3 px-4 rounded-lg mt-5 ${vmMediaFiles.length === 0 || sending ? 'bg-gray-400' : 'bg-green-500'}`}
          onPress={sendToChat}
          disabled={vmMediaFiles.length === 0 || sending}
        >
          {sending ? (
            <View className="flex-row justify-center items-center">
              <ActivityIndicator size="small" color="white" className="mr-2" />
              <Text className="text-white font-semibold text-center">Sending...</Text>
            </View>
          ) : (
            <Text className="text-white font-semibold text-center">Send to Chat</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const VMMediaThumbnail = ({ file, onPress, onRemove, tempFolderId }: { 
  file: VMMediaFile; 
  onPress: () => void;
  onRemove: () => void;
  tempFolderId: string;
}) => {
  const isImage = file.mimeType.startsWith("image");
  const isAudio = file.mimeType.startsWith("audio");
  const isVideo = file.mimeType.startsWith("video");

  return (
    <View className="w-24 h-24 rounded-lg overflow-hidden justify-center items-center relative bg-gray-100">
      <TouchableOpacity className="w-full h-full" onPress={onPress}>
        {isImage && (
          <Image 
            source={{ 
              uri: `${API_URL}/media/chat/temp_${tempFolderId}/${file.fileName}`,
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
            <Text className="text-2xl mb-1">🎵</Text>
            <Text className="text-white text-xs text-center px-1" numberOfLines={1}>
              {file.originalName}
            </Text>
          </View>
        )}
        {isVideo && (
          <View className="w-full h-full bg-red-500 justify-center items-center">
            <Text className="text-2xl mb-1">🎬</Text>
            <Text className="text-white text-xs text-center px-1" numberOfLines={1}>
              {file.originalName}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        className="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 justify-center items-center"
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
  audioPlayButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 20,
  },
  audioPlayButtonText: {
    color: 'white',
    fontSize: 24,
  },
  audioProgress: {
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  audioTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#4CAF50',
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
  captionContainer: {
    padding: 20,
    backgroundColor: 'white',
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    fontSize: 16,
  },
});
