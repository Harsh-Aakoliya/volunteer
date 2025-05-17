import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  TextInput,
  Modal,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from "expo-av";
import { MediaFile } from '@/types/type';

// Define a file type for local files before upload
export interface LocalMediaFile {
  id: string; // Temp local ID
  name: string;
  uri: string; // Local URI
  mimeType: string;
  message?: string; // Optional message
  progress?: number; // Upload progress (0-100)
  uploaded?: boolean; // Whether file is uploaded
  url?: string; // URL after upload (if uploaded)
  size?: number; // File size
}

interface MediaPreviewCarouselProps {
  files: LocalMediaFile[];
  onUpdateMessage: (fileId: string, message: string) => void;
  onRemoveFile: (fileId: string) => void;
  onUploadAndSend: () => void;
  onCancel: () => void;
  uploading: boolean;
}

const { width } = Dimensions.get('window');

const MediaPreviewCarousel: React.FC<MediaPreviewCarouselProps> = ({
  files,
  onUpdateMessage,
  onRemoveFile,
  onUploadAndSend,
  onCancel,
  uploading
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // if (!files.length) return null;

  const currentFile = files[currentIndex];
  const totalFiles = files.length;
  
  // Handle scroll end to update current index
  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width);
    setCurrentIndex(newIndex);
  };

  // Determine media type
  const isImage = (file: LocalMediaFile) => file.mimeType.startsWith('image');
  const isAudio = (file: LocalMediaFile) => file.mimeType.startsWith('audio');
  const isVideo = (file: LocalMediaFile) => file.mimeType.startsWith('video');

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Render a single media item
  const renderMediaItem = (file: LocalMediaFile, index: number) => {
    return (
      <View key={file.id} style={{ width, padding: 16 }}>
        <View className="bg-gray-100 rounded-lg p-4 mb-3">
          {/* Media preview based on type */}
          <View className="items-center justify-center mb-4">
            {isImage(file) ? (
              <Image
                source={{ uri: file.uri }}
                className="w-full h-56 rounded-lg"
                resizeMode="contain"
              />
            ) : isVideo(file) ? (
              <View className="w-full h-56 bg-black rounded-lg items-center justify-center overflow-hidden">
                <Video
                  source={{ uri: file.uri }}
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping
                  shouldPlay={index === currentIndex}
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            ) : isAudio(file) ? (
              <View className="w-full h-32 bg-purple-100 rounded-lg items-center justify-center">
                <Ionicons name="musical-note" size={48} color="#8B5CF6" />
                <Text className="mt-2 text-purple-700 font-medium">Audio File</Text>
              </View>
            ) : (
              <View className="w-full h-32 bg-gray-200 rounded-lg items-center justify-center">
                <Ionicons name="document" size={48} color="#4B5563" />
                <Text className="mt-2 text-gray-700 font-medium">Unknown File Type</Text>
              </View>
            )}
          </View>
          
          {/* File details */}
          <View className="mb-3">
            <Text className="text-base font-bold text-gray-800 mb-1" numberOfLines={1}>
              {file.name}
            </Text>
            <Text className="text-sm text-gray-500">
              {formatFileSize(file.size)}
            </Text>
          </View>
          
          {/* Optional message input */}
          <View className="mb-2">
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Add a caption (optional)"
              value={file.message || ''}
              onChangeText={(text) => onUpdateMessage(file.id, text)}
              multiline
              numberOfLines={2}
              editable={!uploading}
            />
          </View>
          
          {/* Upload progress indicator */}
          {uploading && typeof file.progress === 'number' && (
            <View className="mt-2">
              <View className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <View 
                  className="h-full bg-blue-500" 
                  style={{ width: `${file.progress}%` }} 
                />
              </View>
              <Text className="text-xs text-gray-500 mt-1 text-right">
                {file.progress}%
              </Text>
            </View>
          )}
          
          {/* Remove button */}
          {!uploading && (
            <TouchableOpacity
              className="absolute top-2 right-2 bg-red-500 rounded-full w-8 h-8 items-center justify-center"
              onPress={() => onRemoveFile(file.id)}
            >
              <Ionicons name="trash-outline" size={16} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={files.length > 0}
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-white safe-area-view">
        <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
          <TouchableOpacity onPress={onCancel} disabled={uploading}>
            <Ionicons name="close-outline" size={28} color={uploading ? "#9CA3AF" : "#374151"} />
          </TouchableOpacity>
          <Text className="text-lg font-bold">Media Preview ({currentIndex + 1}/{totalFiles})</Text>
          <View style={{ width: 28 }} /> 
        </View>
        
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEnabled={!uploading}
        >
          {files.map((file, index) => renderMediaItem(file, index))}
        </ScrollView>
        
        {totalFiles > 1 && (
          <View className="flex-row justify-center my-3">
            {files.map((_, index) => (
              <View
                key={index}
                className={`h-2 mx-1 rounded-full ${
                  currentIndex === index ? 'bg-blue-500 w-4' : 'bg-gray-300 w-2'
                }`}
              />
            ))}
          </View>
        )}
        
        <View className="p-4">
          <TouchableOpacity
            className={`py-3 rounded-lg ${uploading ? 'bg-gray-400' : 'bg-blue-500'}`}
            onPress={onUploadAndSend}
            disabled={uploading}
          >
            <View className="flex-row justify-center items-center">
              {uploading ? (
                <>
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white font-bold ml-2">
                    Uploading...
                  </Text>
                </>
              ) : (
                <Text className="text-white font-bold text-center text-lg">
                  Upload & Send
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default MediaPreviewCarousel;