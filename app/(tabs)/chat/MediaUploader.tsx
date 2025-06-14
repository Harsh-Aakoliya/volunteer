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
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import { Audio } from "expo-av";
import { Video, ResizeMode } from "expo-av";
import { API_URL } from "@/constants/api";
import { TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";


type Media = {
  id: string;
  senderId: string;
  roomId: string;
  driveUrlObject: string;
  messageId: string;
}
// Define types
type MediaFile = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  caption: string;
  media: Media[];
};

type UploadingFile = {
  name: string;
  size: number;
  progress: number;
  mimeType: string;
};

// Format bytes to readable format
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function MediaUploadApp() {
  const { roomId, userId } = useLocalSearchParams();
  console.log("roomId",roomId);
  const [uploading, setUploading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]); // list of uploaded files
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [mediaFilesId, setMediaFilesId] = useState<string>("");
  
  // Handle file selection and upload
  const handleSelectFiles = async () => {
    try {
      // Open document picker
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: ["image/*", "audio/*", "video/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      setUploading(true);
      
      // Initialize progress tracking for each file
      const filesToUpload: UploadingFile[] = result.assets.map(asset => ({
        name: asset.name,
        size: asset.size || 0,
        progress: 0,
        mimeType: asset.mimeType || "",
      }));
      
      setUploadingFiles(filesToUpload);

      // Create form data for upload
      const formData = new FormData();
      result.assets.forEach((asset) => {
        formData.append("files", {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? "application/octet-stream",
        } as any);
      });
      formData.append("userId", userId as string);
      formData.append("roomId", roomId as string);
      try {
        // Use axios with upload progress tracking
        const response = await axios.post(
          `${API_URL}/api/media/upload`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            onUploadProgress: (progressEvent) => {
              const totalSize = result.assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
              const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || totalSize));
              
              // Distribute progress among files proportionally to their size
              if (totalSize > 0) {
                setUploadingFiles(prevFiles => 
                  prevFiles.map(file => ({
                    ...file,
                    progress: (percentCompleted * file.size) / totalSize
                  }))
                );
              }
            },
          }
        );
        setMediaFilesId(response.data.mediaId);
        console.log("response got after uploading files",response.data);
        // Add the newly uploaded files to our media files list
        const newFiles = response.data.uploaded.map((file: any, idx: number) => ({
          ...file,
          mimeType: result.assets[idx].mimeType ?? "",
        }));
        setMediaFiles((prev) => [...prev, ...newFiles]);
        console.log("mediaFiles after upload",mediaFiles);
        // Clear uploading files after successful upload
        setTimeout(() => {
          setUploadingFiles([]);
        }, 1000);
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

  const openPreview = (file: MediaFile) => {
    setSelectedFile(file);
    setModalVisible(true);
  };

  const closePreview = () => {
    setModalVisible(false);
    setSelectedFile(null);
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 p-5">
        <Text className="text-2xl font-bold mb-5">Media Uploader</Text>
        
        {/* Upload button */}
        <TouchableOpacity 
          onPress={handleSelectFiles}
          className={`py-3 px-4 rounded-lg mb-5 ${uploading ? 'bg-gray-400' : 'bg-blue-500'}`}
          disabled={uploading}
        >
          <Text className="text-white font-semibold text-center">
            {uploading ? "Uploading..." : "Select & Upload Files"}
          </Text>
        </TouchableOpacity>
        
        {/* Upload progress section */}
        {uploadingFiles.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">Upload Progress</Text>
            {uploadingFiles.map((file, index) => (
              <View key={index} className="mb-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm" numberOfLines={1}>{file.name}</Text>
                  <Text className="text-sm text-blue-600">
                    {formatBytes(Math.round(file.progress * file.size / 100))}/{formatBytes(file.size)}
                  </Text>
                </View>
                {/* Progress bar */}
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.min(file.progress, 100)}%` }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Uploaded files grid */}
        <Text className="text-lg font-semibold mb-2">
          {mediaFiles.length > 0 ? 'Uploaded Files' : 'No files uploaded yet'}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {mediaFiles.map((file, index) => (
            <MediaThumbnail 
              key={index} 
              file={file} 
              onPress={() => openPreview(file)} 
            />
          ))}
        </View>

        {/* Preview modal */}
        {selectedFile && (
          <MediaPreviewModal
            visible={modalVisible}
            file={selectedFile}
            onClose={closePreview}
            mediaFiles={mediaFiles}
            setMediaFiles={setMediaFiles}
          />
        )}
        
        {/* sending media to chat  */}
        <TouchableOpacity
          className={`py-3 px-4 rounded-lg mt-5 ${mediaFiles.length === 0 || sending ? 'bg-gray-400' : 'bg-green-500'}`}
          onPress={async () => {
            console.log("mediaFile length",mediaFiles.length);
            console.log("roomId",roomId);
            console.log("sending",sending);
            if (mediaFiles.length === 0 || !roomId || sending) return;

            try {
              setSending(true);
              const token = await AuthStorage.getToken();
              
              const mediaFilesPayload = mediaFiles.map(file => ({
                id: file.id,
                url: file.url,
                caption: file.caption?file.caption:""
              }));
              console.log("mediaFilesPayload",mediaFilesPayload);
              
              // Optional: Set messageText to empty or use a generic message
              const messageText = ""; // or keep it blank if you don't need this

              await axios.post(
                `${API_URL}/api/chat/rooms/${roomId}/messages`,
                { 
                  messageText,
                  mediaFiles: mediaFilesPayload, // <-- send this in request body
                  messageType: "media",
                  mediaFilesId:mediaFilesId
                },
                {
                  headers: { Authorization: `Bearer ${token}` }
                }
              );
              router.back();
            } catch (error) {
              console.error("Error sending media:", error);
              Alert.alert("Error", "Failed to send media");
            } finally {
              setSending(false);
            }
          }}
          disabled={mediaFiles.length === 0 || sending}
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

// Media thumbnail component
const MediaThumbnail = ({ file, onPress }: { file: MediaFile; onPress: () => void }) => {
  const isImage = file.mimeType.startsWith("image");
  const isAudio = file.mimeType.startsWith("audio");
  const isVideo = file.mimeType.startsWith("video");
  
  let thumbnailContent;
  let containerClass = "w-24 h-24 rounded-lg overflow-hidden justify-center items-center";
  
  if (isImage) {
    containerClass += " bg-gray-100";
    thumbnailContent = (
      <Image 
        source={{ uri: file.url }} 
        className="w-full h-full" 
        resizeMode="cover"
      />
    );
  } else if (isAudio) {
    containerClass += " bg-purple-500";
    thumbnailContent = (
      <>
        <Text className="text-2xl mb-1">🎵</Text>
        <Text className="text-white text-xs text-center px-1" numberOfLines={1}>
          {file.name}
        </Text>
      </>
    );
  } else if (isVideo) {
    containerClass += " bg-red-500";
    thumbnailContent = (
      <>
        <Text className="text-2xl mb-1">🎬</Text>
        <Text className="text-white text-xs text-center px-1" numberOfLines={1}>
          {file.name}
        </Text>
      </>
    );
  }

  return (
    <TouchableOpacity className={containerClass} onPress={onPress}>
      {thumbnailContent}
    </TouchableOpacity>
  );
};

// Audio player component
const AudioPlayer = ({ uri }: { uri: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let isMounted = true;
    
    const loadSound = async () => {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync({ uri });
        
        if (isMounted) {
          setSound(newSound);
          setLoading(false);
          
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
            }
          });
        }
      } catch (error) {
        console.error("Failed to load audio:", error);
        if (isMounted) setLoading(false);
      }
    };

    loadSound();
    
    return () => {
      isMounted = false;
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [uri]);

  const togglePlayback = async () => {
    if (!sound) return;
    
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  if (loading) {
    return (
      <View className="h-20 w-full justify-center items-center">
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View className="h-20 w-full justify-center items-center bg-gray-100 rounded-lg">
      <TouchableOpacity 
        onPress={togglePlayback}
        className="bg-blue-500 p-3 rounded-full"
      >
        <Text className="text-white font-bold text-lg">
          {isPlaying ? "Pause" : "Play"}
        </Text>
      </TouchableOpacity>
      <Text className="mt-2 text-center text-gray-700">
        {isPlaying ? "Now playing..." : "Audio ready to play"}
      </Text>
    </View>
  );
};

// Media preview modal
const MediaPreviewModal = ({ 
  visible, 
  file, 
  onClose,
  mediaFiles,
  setMediaFiles
}: { 
  visible: boolean; 
  file: MediaFile | null; 
  onClose: () => void;
  mediaFiles: MediaFile[];
  setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>
}) => {
  if (!file) return null;

  const isImage = file.mimeType.startsWith("image");
  const isAudio = file.mimeType.startsWith("audio");
  const isVideo = file.mimeType.startsWith("video");
  
  // Find the current caption value for this file
  const currentCaption = mediaFiles.find(f => f.id === file.id)?.caption || '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
    >
      <View className="flex-1 justify-center items-center bg-black/75">
        <View className="bg-white w-11/12 rounded-xl p-4 max-h-3/4">
          <Text className="text-xl font-bold mb-4 text-center">{file.name}</Text>
          
          <View className="mb-4 items-center">
            {isImage && (
              <Image 
                source={{ uri: file.url }} 
                className="w-full h-64 rounded-lg" 
                resizeMode="contain"
              />
            )}
            
            {isVideo && (
              <Video
                source={{ uri: file.url }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                className="w-full h-64 rounded-lg"
              />
            )}
            
            {isAudio && <AudioPlayer uri={file.url} />}
          </View>
          <TextInput
            className="bg-gray-100 rounded-lg px-4 py-2 mb-4"
            placeholder="Add caption to this media..."
            onChangeText={(text) => setMediaFiles((prev: MediaFile[]) => 
              prev.map((f: MediaFile) => f.id === file.id ? {...f, caption: text} : f)
            )}
            multiline={true}
            value={currentCaption}
          />
          <TouchableOpacity 
            onPress={onClose}
            className="bg-red-500 py-2 rounded-lg"
          >
            <Text className="text-white font-bold text-center">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};