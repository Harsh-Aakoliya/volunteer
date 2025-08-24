import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image,
  Platform,
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cssInterop } from "nativewind";
import WebView from 'react-native-webview';
import { getPreviewHTML } from '@/components/HtmlPreview';
import { API_URL } from '@/constants/api';
import ImageViewer from '@/components/texteditor/ImageViewer';
import VideoViewer from '@/components/texteditor/VideoViewer';
import AudioViewer from '@/components/texteditor/AudioViewer';
import LottieView from 'lottie-react-native';

const StyledWebView = cssInterop(WebView, {
  className: "style",
});

interface Step4PreviewProps {
  title: string;
  content: string;
  announcementId: number;
  selectedUserIds: string[];
  attachedMediaFiles: any[];
  onPublish: () => Promise<void>;
  onBack: () => void;
  isEdit?: boolean;
}

export default function Step4Preview({ 
  title,
  content,
  announcementId,
  selectedUserIds,
  attachedMediaFiles,
  onPublish, 
  onBack,
  isEdit = false
}: Step4PreviewProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishingAnimation, setShowPublishingAnimation] = useState(false);
  
  // Media viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState<any>(null);
  const [showAudioViewer, setShowAudioViewer] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<any>(null);
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<any>(null);

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

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPreviewHTMLContent = useCallback(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 16px;
              margin: 0;
              color: #1f2937;
              font-size: 16px;
              line-height: 1.5;
              background-color: white;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            ul, ol {
              padding-left: 20px;
            }
            a {
              color: #2563eb;
              text-decoration: underline;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              line-height: 1.2;
            }
            h1 { font-size: 1.8em; }
            h2 { font-size: 1.5em; }
            blockquote {
              border-left: 4px solid #e5e7eb;
              padding-left: 16px;
              margin-left: 0;
              color: #4b5563;
            }
            pre {
              background-color: #f3f4f6;
              padding: 16px;
              border-radius: 4px;
              overflow-x: auto;
            }
            code {
              font-family: monospace;
              background-color: #f3f4f6;
              padding: 2px 4px;
              border-radius: 4px;
            }
            .announcement-title {
              font-size: 24px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 16px;
              color: #111827;
            }
            .announcement-date {
              text-align: center;
              margin-bottom: 24px;
              color: #6b7280;
            }
            .announcement-content {
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="announcement-title">${title}</div>
          <div class="announcement-date">${formatDateTime(new Date().toISOString())}</div>
          <div class="announcement-content">
            ${content}
          </div>
        </body>
      </html>
    `;
  }, [title, content]);

  const handlePublish = async () => {
    Alert.alert(
      isEdit ? "Update Announcement" : "Publish Announcement",
      isEdit 
        ? "Are you sure you want to update this announcement? All selected users will receive the updated version."
        : "Are you sure you want to publish this announcement? All selected users will receive it immediately.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: isEdit ? "Update" : "Publish", 
          style: "default",
          onPress: async () => {
            try {
              setIsPublishing(true);
              setShowPublishingAnimation(true);
              
              await onPublish();
              
              // Keep animation visible for a moment before redirect
              setTimeout(() => {
                setShowPublishingAnimation(false);
                setIsPublishing(false);
              }, 2000);
              
            } catch (error) {
              setIsPublishing(false);
              setShowPublishingAnimation(false);
              console.error('Publishing error:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={onBack} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Preview Changes' : 'Preview & Publish'}
        </Text>
        
        <View className="w-8" />
      </View>

      {/* Step indicator */}
      <View className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <Text className="text-blue-800 font-medium text-center">Step 4 of 4: Preview</Text>
        <Text className="text-blue-600 text-sm text-center mt-1">Review and publish your announcement</Text>
      </View>

      <ScrollView className="flex-1 bg-white">
        {/* Recipients Summary */}
        <View className="p-4 bg-green-50 border-b border-green-100">
          <View className="flex-row items-center mb-2">
            <Ionicons name="people" size={16} color="#059669" />
            <Text className="text-green-800 font-medium ml-2">Recipients</Text>
          </View>
          <Text className="text-green-700 text-sm">
            This announcement will be sent to {selectedUserIds.length} selected user{selectedUserIds.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* HTML Content Preview */}
        {Platform.OS === "ios" || Platform.OS === "android" ? (
          <StyledWebView
            className="flex-1"
            originWhitelist={["*"]}
            source={{ html: getPreviewHTMLContent() }}
            showsVerticalScrollIndicator={false}
            style={{ height: 400 }}
          />
        ) : (
          <View className="p-4">
            <Text className="text-2xl font-bold text-center mb-4">{title}</Text>
            <Text className="text-gray-500 text-center mb-6">{formatDateTime(new Date().toISOString())}</Text>
            <Text>{content}</Text>
          </View>
        )}

        {/* Media Files Section */}
        {attachedMediaFiles.length > 0 && (
          <View className="p-4">
            <Text className="text-lg font-semibold text-gray-900 mb-4">Attached Media Files</Text>
            
            {attachedMediaFiles.map((file, index) => {
              if (file.mimeType.startsWith('image/')) {
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleImageClick(file)}
                    className="bg-white p-1 rounded-lg mb-3 border border-gray-200 shadow-sm"
                  >
                    <Image
                      source={{ uri: `${API_URL}/media/announcement/${announcementId}/media/${file.fileName}` }}
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
              } else if (file.mimeType.startsWith('video/')) {
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleVideoClick(file)}
                    className="flex-row items-center bg-white p-3 rounded-lg mb-3 border border-gray-200 shadow-sm"
                  >
                    <View className="w-16 h-16 bg-red-100 rounded-lg mr-3 items-center justify-center">
                      <Ionicons name="play" size={24} color="#dc2626" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900">{file.originalName || file.fileName}</Text>
                      <Text className="text-sm text-gray-600">Video file • Tap to play</Text>
                    </View>
                  </TouchableOpacity>
                );
              } else if (file.mimeType.startsWith('audio/')) {
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleAudioClick(file)}
                    className="flex-row items-center bg-white p-3 rounded-lg mb-3 border border-gray-200 shadow-sm"
                  >
                    <View className="w-16 h-16 bg-purple-100 rounded-lg mr-3 items-center justify-center">
                      <Ionicons name="musical-notes" size={24} color="#8b5cf6" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900">{file.originalName || file.fileName}</Text>
                      <Text className="text-sm text-gray-600">Audio file • Tap to play</Text>
                    </View>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        )}
      </ScrollView>

      {/* Navigation Buttons */}
      <View className="p-4 bg-white border-t border-gray-200">
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={onBack}
            disabled={isPublishing}
            className="flex-1 py-3 px-6 rounded-lg border border-gray-300"
          >
            <Text className="text-gray-700 text-center font-semibold">Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handlePublish}
            disabled={isPublishing}
            className={`flex-1 py-3 px-6 rounded-lg ${
              isPublishing ? 'bg-gray-400' : 'bg-green-600'
            }`}
          >
            <Text className="text-white text-center font-semibold">
              {isPublishing 
                ? 'Publishing...' 
                : isEdit ? 'Update Announcement' : 'Publish Announcement'
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Publishing Animation Modal */}
      <Modal
        visible={showPublishingAnimation}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 bg-black bg-opacity-50 items-center justify-center">
          <View className="bg-white rounded-lg p-8 items-center">
            <View className="w-24 h-24 mb-4">
              {/* You can add a Lottie animation here */}
              <View className="w-full h-full bg-green-100 rounded-full items-center justify-center">
                <Ionicons name="checkmark" size={48} color="#059669" />
              </View>
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-2">
              {isEdit ? 'Updating...' : 'Publishing...'}
            </Text>
            <Text className="text-gray-600 text-center">
              {isEdit 
                ? 'Your announcement is being updated'
                : 'Your announcement is being published'
              }
            </Text>
          </View>
        </View>
      </Modal>

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
