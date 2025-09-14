import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Alert,
  Dimensions
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import axios from 'axios';
import AnnouncementMediaUploader from '@/components/texteditor/AnnouncementMediaUploader';
import ImageViewer from '@/components/texteditor/ImageViewer';
import VideoViewer from '@/components/texteditor/VideoViewer';
import AudioViewer from '@/components/texteditor/AudioViewer';

interface Step2MediaProps {
  announcementId: number;
  hasCoverImage: boolean;
  onNext: (hasCoverImage: boolean, mediaFiles: any[]) => void;
  onBack: () => void; // header/hardware back -> show alert in wizard
  onPrevious: () => void; // bottom Previous -> no alert, just navigate
  isEdit?: boolean;
}

export default function Step2Media({ 
  announcementId, 
  hasCoverImage: initialHasCoverImage,
  onNext, 
  onBack,
  onPrevious,
  isEdit = false
}: Step2MediaProps) {
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [coverImageUri, setCoverImageUri] = useState('');
  const [hasCoverImage, setHasCoverImage] = useState(initialHasCoverImage);
  const [attachedMediaFiles, setAttachedMediaFiles] = useState<any[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Media viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState<any>(null);
  const [showAudioViewer, setShowAudioViewer] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<any>(null);
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<any>(null);

  const screenWidth = Dimensions.get('window').width;
  const mediaItemWidth = (screenWidth - 48) / 2; // 48 = padding (16*2) + gap (16)

  // Initialize cover image
  useEffect(() => {
    if (initialHasCoverImage) {
      setCoverImageUri(`${API_URL}/media/announcement/${announcementId}/coverimage.jpg?t=${Date.now()}`);
    } else {
      setCoverImageUri(`${API_URL}/media/defaultcoverimage.png`);
    }
  }, [initialHasCoverImage, announcementId]);

  const handleSelectCoverImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: ["image/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      
      if (!asset.mimeType?.startsWith('image/')) {
        Alert.alert("Invalid File", "Please select an image file only.");
        return;
      }

      setIsUploadingCover(true);
      setUploadProgress(0);

      try {
        const fileData = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        setUploadProgress(30);

        const fileToUpload = {
          name: asset.name,
          mimeType: asset.mimeType || "image/jpeg",
          fileData,
        };

        setUploadProgress(50);

        const token = await AuthStorage.getToken();
        const response = await axios.post(
          `${API_URL}/api/announcements/cover-image`,
          {
            files: [fileToUpload],
            announcementId: announcementId
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        setUploadProgress(80);

        if (response.data.success) {
          const newImageUri = `${API_URL}/media/announcement/${announcementId}/coverimage.jpg?t=${Date.now()}`;
          setCoverImageUri(newImageUri);
          setHasCoverImage(true);
          setUploadProgress(100);
          
          Alert.alert("Success", "Cover image uploaded successfully!");
        } else {
          throw new Error("Upload failed");
        }

      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Upload failed", "There was an error uploading your cover image.");
        setCoverImageUri(`${API_URL}/media/defaultcoverimage.png`);
        setHasCoverImage(false);
      } finally {
        setIsUploadingCover(false);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error("File selection error:", error);
      setIsUploadingCover(false);
    }
  };

  // Handle media file clicks
  const handleImageClick = (file: any) => {
    setSelectedMediaFile(file);
    setImageViewerVisible(true);
  };

  const handleVideoClick = (file: any) => {
    setSelectedVideoFile(file);
    setShowVideoViewer(true);
  };

  const handleAudioClick = (file: any) => {
    setSelectedAudioFile(file);
    setShowAudioViewer(true);
  };

  const renderMediaGrid = () => {
    if (attachedMediaFiles.length === 0) {
      return (
        <View className="items-center py-8">
          <Ionicons name="cloud-upload-outline" size={48} color="#9ca3af" />
          <Text className="text-gray-500 mt-2">No media files attached</Text>
          <Text className="text-gray-400 text-sm">Media files are optional</Text>
        </View>
      );
    }

    const rows = [];
    for (let i = 0; i < attachedMediaFiles.length; i += 2) {
      const leftFile = attachedMediaFiles[i];
      const rightFile = attachedMediaFiles[i + 1];
      
      rows.push(
        <View key={i} className="flex-row justify-between mb-4">
          {/* Left item */}
          <View style={{ width: mediaItemWidth }}>
            {renderMediaItem(leftFile)}
          </View>
          
          {/* Right item or spacer */}
          {rightFile ? (
            <View style={{ width: mediaItemWidth }}>
              {renderMediaItem(rightFile)}
            </View>
          ) : (
            <View style={{ width: mediaItemWidth }} />
          )}
        </View>
      );
    }
    
    return <View>{rows}</View>;
  };

  const renderMediaItem = (file: any) => {
    if (file.mimeType.startsWith('image/')) {
      return (
        <TouchableOpacity
          onPress={() => handleImageClick(file)}
          className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
          style={{ height: mediaItemWidth }}
        >
          <Image
            source={{ uri: `${API_URL}/media/announcement/${announcementId}/media/${file.fileName}` }}
            style={{ width: '100%', height: '80%' }}
            resizeMode="cover"
          />
          <View className="p-2 h-20%">
            <Text className="text-xs text-gray-600 text-center" numberOfLines={1}>
              📷 {file.originalName || file.fileName}
            </Text>
          </View>
        </TouchableOpacity>
      );
    } else if (file.mimeType.startsWith('video/')) {
      return (
        <TouchableOpacity
          onPress={() => handleVideoClick(file)}
          className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden items-center justify-center"
          style={{ height: mediaItemWidth }}
        >
          <View className="bg-red-100 w-16 h-16 rounded-full items-center justify-center mb-2">
            <Ionicons name="play" size={32} color="#dc2626" />
          </View>
          <Text className="text-xs text-gray-600 text-center px-2" numberOfLines={2}>
            🎥 {file.originalName || file.fileName}
          </Text>
        </TouchableOpacity>
      );
    } else if (file.mimeType.startsWith('audio/')) {
      return (
        <TouchableOpacity
          onPress={() => handleAudioClick(file)}
          className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden items-center justify-center"
          style={{ height: mediaItemWidth }}
        >
          <View className="bg-purple-100 w-16 h-16 rounded-full items-center justify-center mb-2">
            <Ionicons name="musical-notes" size={32} color="#8b5cf6" />
          </View>
          <Text className="text-xs text-gray-600 text-center px-2" numberOfLines={2}>
            🎵 {file.originalName || file.fileName}
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const handleNext = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    onNext(hasCoverImage, attachedMediaFiles);
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={onBack} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Media' : 'Add Media'}
        </Text>
        
        <View className="w-8" />
      </View>

      {/* Removed step indicator */}

      <ScrollView className="flex-1 px-4 py-4">
        {/* Cover Image Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Cover Image <Text className="text-gray-500 font-normal">(optional)</Text></Text>
          <View className="items-center">
            <TouchableOpacity
              onPress={handleSelectCoverImage}
              disabled={isUploadingCover}
              className="relative"
            >
              <View className="w-[200px] h-[200px] bg-gray-200 rounded-lg overflow-hidden">
                <Image
                  source={{ uri: coverImageUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                
                {isUploadingCover && (
                  <View className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <View className="bg-white bg-opacity-90 p-4 rounded-lg items-center">
                      <Text className="text-gray-800 text-sm mb-2">Uploading...</Text>
                      <View className="w-32 h-2 bg-gray-300 rounded-full overflow-hidden">
                        <View 
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </View>
                      <Text className="text-gray-600 text-xs mt-1">{uploadProgress}%</Text>
                    </View>
                  </View>
                )}
              </View>
              
              <Text className="text-sm text-gray-600 mt-2 text-center">
                {hasCoverImage ? 'Tap to change cover image' : 'Tap to add cover image'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="border-b border-gray-200 mb-4" />

        {/* Media Files Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Attach Media Files <Text className="text-gray-500 font-normal">(optional)</Text></Text>
          
          {/* Media Uploader Component */}
          <AnnouncementMediaUploader 
            announcementId={announcementId}
            onMediaChange={setAttachedMediaFiles}
          />
          
          {/* Media Grid */}
          <View className="mt-4">
            {renderMediaGrid()}
          </View>
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View className="p-4 bg-white border-t border-gray-200">
        <View className="flex-row space-x-4">
          <TouchableOpacity
            onPress={onPrevious}
            disabled={isNavigating}
            className="flex-1 py-3 px-6 rounded-lg border border-gray-300"
          >
            <Text className="text-gray-700 text-center font-semibold">Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleNext}
            disabled={isNavigating}
            className={`flex-1 py-3 px-6 rounded-lg ${isNavigating ? 'bg-gray-300' : 'bg-blue-600'}`}
          >
            <Text className="text-white text-center font-semibold">{isNavigating ? 'Loading...' : 'Next: Recipients'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Media Viewers */}
      {selectedMediaFile && (
        <ImageViewer
          visible={imageViewerVisible}
          imageUri={`${API_URL}/media/announcement/${announcementId}/media/${selectedMediaFile.fileName}`}
          onClose={() => {
            setImageViewerVisible(false);
            setSelectedMediaFile(null);
          }}
          title={selectedMediaFile.originalName || selectedMediaFile.fileName}
        />
      )}

      {selectedVideoFile && (
        <VideoViewer
          visible={showVideoViewer}
          videoUri={`${API_URL}/media/announcement/${announcementId}/media/${selectedVideoFile.fileName}`}
          onClose={() => {
            setShowVideoViewer(false);
            setSelectedVideoFile(null);
          }}
          title={selectedVideoFile.originalName || selectedVideoFile.fileName}
        />
      )}

      {selectedAudioFile && (
        <AudioViewer
          visible={showAudioViewer}
          audioUri={`${API_URL}/media/announcement/${announcementId}/media/${selectedAudioFile.fileName}`}
          onClose={() => {
            setShowAudioViewer(false);
            setSelectedAudioFile(null);
          }}
          title={selectedAudioFile.originalName || selectedAudioFile.fileName}
          size={selectedAudioFile.size}
        />
      )}
    </View>
  );
}
