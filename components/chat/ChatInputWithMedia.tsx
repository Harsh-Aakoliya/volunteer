import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  Image,
  ScrollView,
  FlatList
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import { MediaFile } from "@/types/type";
import { API_URL } from "@/constants/api";
import { Video, ResizeMode } from "expo-av";

// Local media file type
interface LocalMediaFile {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size?: number;
  uploaded?: boolean;
  uploadedUrl?: string;
  message?: string;
  progress?: number;
}

interface ChatInputWithMediaProps {
  onSendMessage: (text: string, mediaFiles?: MediaFile[]) => void;
  sending: boolean;
}

const ChatInputWithMedia: React.FC<ChatInputWithMediaProps> = ({
  // onSendMessage,
  // sending,
}) => {
  const [messageText, setMessageText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<LocalMediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<MediaFile[]>([]);
  const [showingMediaPreview, setShowingMediaPreview] = useState(false);

  // Handle file selection
  const handleSelectFiles = async () => {
    try {
      // Open document picker to select files
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: ["image/*", "audio/*", "video/*"],
        copyToCacheDirectory: true,
      });
  
      if (result.canceled || result.assets.length === 0) {
        return;
      }
  
      // Create local file entries with unique IDs and local URIs
      const localFiles: LocalMediaFile[] = result.assets.map((asset, index) => ({
        id: `local-${Date.now()}-${index}`,
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: asset.size,
        progress: 0,
      }));
      
      // Set files and show the preview
      setSelectedFiles(localFiles);
      setShowingMediaPreview(true);
    } catch (error) {
      console.error("File selection error:", error);
      alert("An error occurred while selecting files");
    }
  };

  // Upload files to server
  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0 || isUploading) return;
    
    setIsUploading(true);
    const uploadedMedia: MediaFile[] = [];
    
    try {
      // Upload each file separately
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Create form data for a single file
        const formData = new FormData();
        formData.append("files", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        } as any);
        
        // Update progress state for this file
        const updateProgress = (progress: number) => {
          setSelectedFiles(prev => prev.map(f => 
            f.id === file.id ? { ...f, progress } : f
          ));
        };
        
        try {
          // Start with initial progress
          updateProgress(0);
          
          // Upload the file
          const response = await axios.post(
            `${API_URL}/api/upload`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
              onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round(
                  (progressEvent.loaded * 100) / (progressEvent.total || 1)
                );
                updateProgress(percentCompleted);
              },
            }
          );
          
          // Mark as uploaded successfully
          updateProgress(100);
          
          // Get the uploaded file data from the response
          const uploadedFile = response.data.uploaded[0];
          
          // Update the selected file with the uploaded URL
          setSelectedFiles(prev => prev.map(f => 
            f.id === file.id ? { 
              ...f, 
              uploaded: true,
              uploadedUrl: uploadedFile.url 
            } : f
          ));
          
          // Add to our uploadedMedia array
          uploadedMedia.push({
            id: uploadedFile.id,
            name: uploadedFile.name,
            url: uploadedFile.url,
            mimeType: file.mimeType,
          });
          
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          // Mark the file as failed
          setSelectedFiles(prev => prev.map(f => 
            f.id === file.id ? { ...f, progress: 0, error: true } : f
          ));
        }
      }
      
      // After all files are uploaded, update state
      setUploadedFiles(uploadedMedia);
      setIsUploading(false);
      
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
      alert("Failed to upload files");
    }
  };

  // Send message with media files
  const handleSendMessage = () => {
    if ((!messageText.trim() && uploadedFiles.length === 0) || sending || isUploading) return;
    
    // If we have no media files, just send the text message
    if (selectedFiles.length === 0) {
      onSendMessage(messageText);
      setMessageText("");
      return;
    }
    
    // For each uploaded file, create a message with the file's caption
    const mediaFilesWithMessages = selectedFiles.map(file => ({
      id: file.id,
      name: file.name,
      url: file.uploadedUrl || "",
      mimeType: file.mimeType,
      message: file.message || ""
    }));
    
    // Send each media file as a message
    mediaFilesWithMessages.forEach(file => {
      if (file.url) {
        const mediaFile = {
          id: file.id,
          name: file.name,
          url: file.url,
          mimeType: file.mimeType
        };
        onSendMessage(file.message || "", [mediaFile]);
      }
    });
    
    // Reset state
    setMessageText("");
    setSelectedFiles([]);
    setUploadedFiles([]);
    setShowingMediaPreview(false);
  };

  // Update message for a specific media file
  const updateMediaFileMessage = (fileId: string, message: string) => {
    setSelectedFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, message } : file
      )
    );
  };

  // Remove a selected file
  const removeFile = (id: string) => {
    setSelectedFiles(prev => {
      const updatedFiles = prev.filter(file => file.id !== id);
      
      if (updatedFiles.length === 0) {
        setShowingMediaPreview(false);
      }
      
      return updatedFiles;
    });
  };

  // Render a preview item
  const renderMediaPreviewItem = ({ item }: { item: LocalMediaFile }) => {
    const isImage = item.mimeType.startsWith("image");
    const isAudio = item.mimeType.startsWith("audio");
    const isVideo = item.mimeType.startsWith("video");
    
    return (
      <View className="mr-2 mb-2 bg-gray-100 rounded-lg overflow-hidden" style={{ width: 250 }}>
        {/* Media preview */}
        <View className="h-36 w-full justify-center items-center">
          {isImage && (
            <Image
              source={{ uri: item.uploadedUrl || item.uri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          )}
          {isAudio && (
            <View className="w-full h-full bg-purple-500 justify-center items-center">
              <Ionicons name="musical-note" size={48} color="white" />
            </View>
          )}
          {isVideo && (
            <View className="w-full h-full bg-black">
              <Video
                source={{ uri: item.uploadedUrl || item.uri }}
                resizeMode={ResizeMode.CONTAIN}
                style={{ width: '100%', height: '100%' }}
                shouldPlay={false}
              />
              <View className="absolute inset-0 items-center justify-center">
                <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.8)" />
              </View>
            </View>
          )}
          
          {/* Upload progress indicator */}
          {isUploading && typeof item.progress === 'number' && (
            <View className="absolute inset-0 bg-black bg-opacity-30 justify-center items-center">
              <View className="bg-white p-2 rounded-lg">
                <Text>{item.progress}%</Text>
              </View>
            </View>
          )}
          
          {/* Remove button */}
          {!isUploading && (
            <TouchableOpacity
              className="absolute top-2 right-2 bg-red-500 rounded-full w-8 h-8 items-center justify-center"
              onPress={() => removeFile(item.id)}
            >
              <Ionicons name="trash-outline" size={16} color="white" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Caption input - only shown after upload */}
        {item.uploaded && (
          <View className="p-2">
            <TextInput
              className="border border-gray-300 rounded-md p-2 bg-white"
              placeholder="Add a caption..."
              value={item.message || ""}
              onChangeText={(text) => updateMediaFileMessage(item.id, text)}
              multiline
              maxLength={200}
            />
          </View>
        )}
        
        {/* File name */}
        <View className="p-2">
          <Text className="text-sm font-bold" numberOfLines={1}>{item.name}</Text>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Media Preview Section */}
      {showingMediaPreview && selectedFiles.length > 0 && (
        <View className="p-2 border-t border-gray-200 bg-gray-50">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="font-bold text-gray-700">Selected Media ({selectedFiles.length})</Text>
            {!isUploading ? (
              selectedFiles.some(file => file.uploaded) ? (
                <TouchableOpacity 
                  className="bg-green-500 px-3 py-1 rounded-md"
                  onPress={handleSendMessage}
                >
                  <Text className="text-white font-bold">Send</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  className="bg-blue-500 px-3 py-1 rounded-md"
                  onPress={handleUploadFiles}
                >
                  <Text className="text-white font-bold">Upload</Text>
                </TouchableOpacity>
              )
            ) : (
              <ActivityIndicator size="small" color="#3B82F6" />
            )}
          </View>
          
          <FlatList
            data={selectedFiles}
            renderItem={renderMediaPreviewItem}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 8 }}
          />
        </View>
      )}
      
      
    </>
  );
};

export default ChatInputWithMedia;