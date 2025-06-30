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
import { Video, ResizeMode, Audio } from "expo-av";
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

  // Modal states
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VMMediaFile | null>(null);

  console.log("selectedFile",selectedFile);
  // Audio states
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [audioStatus, setAudioStatus] = useState({
    isLoaded: false,
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
  });

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
            // On web, `asset.file` is a File object
            const file = asset.file ?? (asset as any); // fallback if file is not present
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
            // On native
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
  
      console.log("file with data", filesWithData);
  
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
  
        if (response.data.success) {
          setTempFolderId(response.data.tempFolderId);
          setVmMediaFiles((prev) => [...prev, ...response.data.uploadedFiles]);
        }
  
        setTimeout(() => setUploadingFiles([]), 1000);
      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Error", "Failed to upload files");
        setUploadingFiles([]);
      } finally {
        setUploading(false);
      }
    } catch (error) {
      console.error("File selection error:", error);
      Alert.alert("Error", "An error occurred while selecting files");
      setUploading(false);
      setUploadingFiles([]);
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
    if (vmMediaFiles.length === 0 || !roomId || sending || !tempFolderId) return;
    try {
      setSending(true);
      const token = await AuthStorage.getToken();
      const filesWithCaptions = vmMediaFiles.map(file => ({
        fileName: file.fileName,
        originalName: file.originalName,
        caption: file.caption,
        mimeType: file.mimeType,
        size: file.size
      }));
      
      await axios.post(
        `${API_URL}/api/vm-media/move-to-chat`,
        { 
          tempFolderId,
          roomId,
          senderId: userId,
          filesWithCaptions
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Mark as successfully sent to bypass alert
      setIsSuccessfullySent(true);
      
      // Navigate directly to the chat room
      router.push(`/chat/${roomId}`);
    } catch (error) {
      console.error("Error sending media:", error);
      Alert.alert("Error", "Failed to send media to chat");
    } finally {
      setSending(false);
    }
  };

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

  const openFileModal = (file: VMMediaFile) => {
    setSelectedFile(file);
    if (file.mimeType.startsWith("image")) {
      setImageModalVisible(true);
    } else if (file.mimeType.startsWith("video")) {
      setVideoModalVisible(true);
    } else if (file.mimeType.startsWith("audio")) {
      setAudioModalVisible(true);
    }
  };

  const closeAudioModal = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    setAudioModalVisible(false);
    setSelectedFile(null);
    setAudioStatus({
      isLoaded: false,
      isPlaying: false,
      positionMillis: 0,
      durationMillis: 0,
    });
  };

  const playPauseAudio = async () => {
    if (!selectedFile) return;

    try {
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: `${API_URL}/api/vm-media/file/${selectedFile.url}` },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setAudioStatus({
                isLoaded: status.isLoaded,
                isPlaying: status.isPlaying || false,
                positionMillis: status.positionMillis || 0,
                durationMillis: status.durationMillis || 0,
              });
            }
          }
        );
        setSound(newSound);
      } else {
        if (audioStatus.isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
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
    <Image
        source={{ uri: 'http://172.22.64.1:3000/media/tempppp.jpg' }}
        style={{ width: 200, height: 200 }}
    />
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
            {selectedFile && (
              <>
                <Video
                  source={{ uri: `${API_URL}/api/vm-media/file/${selectedFile.url}` }}
                  style={styles.video}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                />
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
                    source={{ uri: `${API_URL}/api/vm-media/file/${selectedFile.url}` }}
                    style={styles.image}
                    resizeMode="contain"
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

        {/* Audio Modal */}
        <Modal
          visible={audioModalVisible}
          animationType="slide"
          onRequestClose={closeAudioModal}
        >
          <View style={styles.audioModal}>
            <View style={styles.audioHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeAudioModal}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
            
            {selectedFile && (
              <>
                <View style={styles.audioPlayer}>
                  <Text style={styles.audioTitle}>🎵 {selectedFile.originalName}</Text>
                  
                  <View style={styles.audioControls}>
                    <TouchableOpacity
                      style={styles.audioButton}
                      onPress={playPauseAudio}
                    >
                      <Text style={styles.audioButtonText}>
                        {audioStatus.isPlaying ? '⏸️ Pause' : '▶️ Play'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {audioStatus.isLoaded && (
                    <View style={styles.audioInfo}>
                      <Text style={styles.audioTime}>
                        {formatDuration(audioStatus.positionMillis)} / {formatDuration(audioStatus.durationMillis)}
                      </Text>
                      
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { 
                              width: `${(audioStatus.positionMillis / audioStatus.durationMillis) * 100 || 0}%` 
                            }
                          ]} 
                        />
                      </View>
                      
                      <Text style={styles.audioStatus}>
                        {audioStatus.isPlaying ? 'Playing...' : 
                         audioStatus.isLoaded ? 'Paused' : 'Loading...'}
                      </Text>
                    </View>
                  )}
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

const VMMediaThumbnail = ({ file, onPress, onRemove }: { 
  file: VMMediaFile; 
  onPress: () => void;
  onRemove: () => void;
}) => {
  const isImage = file.mimeType.startsWith("image");
  const isAudio = file.mimeType.startsWith("audio");
  const isVideo = file.mimeType.startsWith("video");
  
  return (
    <View className="w-24 h-24 rounded-lg overflow-hidden justify-center items-center relative bg-gray-100">
      <TouchableOpacity className="w-full h-full" onPress={onPress}>
        {isImage && (
          <Image 
            source={{ uri: `${API_URL}/api/vm-media/file/${file.url}` }} 
            className="w-full h-full" 
            resizeMode="cover"
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
  video: {
    flex: 1,
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
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  audioControls: {
    marginBottom: 30,
  },
  audioButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  audioButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  audioInfo: {
    width: '100%',
    alignItems: 'center',
  },
  audioTime: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  audioStatus: {
    fontSize: 14,
    color: '#666',
  },

  // Common Styles
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  captionContainer: {
    padding: 20,
    backgroundColor: 'white',
  },
  captionInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 40,
    maxHeight: 100,
  },
});
