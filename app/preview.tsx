//preview.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
  Dimensions
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cssInterop } from "nativewind";
import { RichText, useEditorBridge } from '@10play/tentap-editor';
import { VideoView, useVideoPlayer } from 'expo-video';
import { publishDraft, updateAnnouncement } from '@/api/admin';
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import { formatISTDate } from '@/utils/dateUtils';
import ImageViewer from '@/components/texteditor/ImageViewer';
import VideoViewer from '@/components/texteditor/VideoViewer';
import AudioViewer from '@/components/texteditor/AudioViewer';
// Tentap editor doesn't need cssInterop
import { RichEditor } from 'react-native-pell-rich-editor';
const StyledRichEditor = cssInterop(RichEditor, {
  className: 'style'
});
const AnnouncementPreviewScreen = () => {
  const params = useLocalSearchParams();
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishingAnimation, setShowPublishingAnimation] = useState(false);
  
  // Extract params
  const title = params.title as string || '';
  const content = params.content as string || '';
  const authorName = params.authorName as string || '';
  const announcementId = params.announcementId ? Number(params.announcementId) : undefined;
  const announcementMode = params.announcementMode as string || 'new';
  const departmentTags = params.departmentTags ? JSON.parse(params.departmentTags as string) : [];
  const attachedMediaFiles = params.attachedMediaFiles ? JSON.parse(params.attachedMediaFiles as string) : [];

  console.log("Content got in preview", content);
  const isEdit = announcementMode === 'edit';
  
  // Media viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState<any>(null);
  const [showAudioViewer, setShowAudioViewer] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<any>(null);
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<any>(null);

  const screenWidth = Dimensions.get('window').width;

  // Tentap Editor Bridge for preview
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: content,
    dynamicHeight: true,
  });

  const handleBackToEdit = () => {
    console.log("announcementId", announcementId);
    console.log("title", title);
    console.log("content", content);
    console.log("announcementMode", announcementMode);
    console.log("departmentTags", departmentTags);
    console.log("attachedMediaFiles", attachedMediaFiles);
    console.log("hasCoverImage", params.hasCoverImage);
    console.log("authorName", authorName);
    
    // Navigate back to create-announcement with current content preserved
    router.replace({
      pathname: "../create-announcement",
      params: {
        announcementId: announcementId,
        title: title,
        content: content,
        announcementMode: announcementMode,
        hasCoverImage: params.hasCoverImage || 'false',
        departmentTags: JSON.stringify(departmentTags),
      }
    });
  };


  const handleImageClick = (file: any) => {
    setSelectedMediaFile(file);
    setImageViewerVisible(true);
  };

  const handleAudioClick = (file: any) => {
    setSelectedAudioFile(file);
    setShowAudioViewer(true);
  };

  const handleVideoClick = (file: any) => {
    setSelectedVideoFile(file);
    setShowVideoViewer(true);
  };

  const renderMediaItem = (file: any) => {
    if (file.mimeType.startsWith('image/')) {
      return (
        <TouchableOpacity
          key={file.fileName}
          onPress={() => handleImageClick(file)}
          className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4"
          style={{ height: 200 }}
        >
          <Image
            source={{ uri: `${API_URL}/media/announcement/${announcementId}/media/${file.fileName}` }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    } else if (file.mimeType.startsWith('video/')) {
      return <VideoPreviewItem key={file.fileName} file={file} announcementId={announcementId} onPress={handleVideoClick} />;
    } else if (file.mimeType.startsWith('audio/')) {
      return <AudioPlayerStripe key={file.fileName} file={file} announcementId={announcementId} onPress={handleAudioClick} />;
    }
    return null;
  };

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
              if (isPublishing) return;
              setIsPublishing(true);
              setShowPublishingAnimation(true);
              
              const user = await AuthStorage.getUser();
              if (!user) {
                throw new Error('User not found');
              }
              
              if (isEdit) {
                await updateAnnouncement(announcementId, title, content, departmentTags);
              } else {
                await publishDraft(announcementId as number, title, content, user.userId, departmentTags);
              }
              
              setTimeout(() => {
                setShowPublishingAnimation(false);
                setIsPublishing(false);
                // Navigate back to announcement list
                router.replace('/announcement');
              }, 2000);
              
            } catch (error) {
              setIsPublishing(false);
              setShowPublishingAnimation(false);
              console.error('Publishing error:', error);
              Alert.alert('Error', 'Failed to publish announcement. Please try again.');
            }
          }
        }
      ]
    );
  };


  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Fixed Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white z-10">
        <TouchableOpacity onPress={handleBackToEdit} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-lg font-semibold text-gray-900">
          Preview
        </Text>
        
        <View className="w-8" />
      </View>

      {/* Scrollable Preview Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
        <View className="px-4 py-2">
          <Text className="text-2xl font-bold text-gray-900 mb-1">{title}</Text>
          <Text className="text-sm text-gray-500 mb-2">
            By {authorName} • {formatISTDate(new Date(), { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}  </Text>
          
            <StyledRichEditor
              className="bg-white"
              initialContentHTML={content}
              editorStyle={{
                contentCSSText: `
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  margin: 0;
                  border: none;
                  padding: 0;
                `,
                cssText: `
                  p {
                    margin-top: 0;
                    margin-bottom: 0.5em; /* about one line of spacing */
                  }
                `
              }}
              disabled
            />

        </View>

        {/* Attached Media Files */}
        {attachedMediaFiles.length > 0 && (
          <View className="px-4 pb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-4">Attached Media Files</Text>
            {attachedMediaFiles.map((file: any) => renderMediaItem(file))}
          </View>
        )}
      </ScrollView>

      {/* Fixed Publish Button */}
      <View className="p-4 bg-white border-t border-gray-200">
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={handleBackToEdit}
            disabled={isPublishing}
            className="flex-1 py-3 px-6 rounded-lg border border-gray-300"
          >
            <Text className="text-gray-700 text-center font-semibold">Back to Edit</Text>
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
    </SafeAreaView>
  );
};

// Audio player stripe component
const AudioPlayerStripe: React.FC<{ 
  file: any; 
  announcementId: number | undefined; 
  onPress: (file: any) => void;
}> = ({ file, announcementId, onPress }) => {
  if (!announcementId) return null;

  return (
    <TouchableOpacity
      onPress={() => onPress(file)}
      className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4"
      style={{ height: 80 }}
    >
      <View className="flex-row items-center h-full px-4">
        <View className="w-12 h-12 bg-purple-500 bg-opacity-20 rounded-full items-center justify-center mr-4">
          <Ionicons name="musical-notes" size={24} color="#8b5cf6" />
        </View>
        
        <View className="flex-1">
          <Text className="font-semibold text-gray-900" numberOfLines={1}>
            {file.originalName || file.fileName}
          </Text>
          <Text className="text-sm text-gray-600">Audio file • Tap to play</Text>
        </View>
        
        <TouchableOpacity
          onPress={() => onPress(file)}
          className="w-12 h-12 items-center justify-center"
        >
          <Ionicons name="play-circle" size={32} color="#8b5cf6" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// Video preview component
const VideoPreviewItem: React.FC<{ 
  file: any; 
  announcementId: number | undefined;
  onPress: (file: any) => void;
}> = ({ file, announcementId, onPress }) => {
  if (!announcementId) return null;
  
  const videoUrl = `${API_URL}/media/announcement/${announcementId}/media/${file.fileName}`;
  
  const previewVideoPlayer = useVideoPlayer(videoUrl, player => {
    if (player) {
      player.loop = false;
      player.muted = true;
      player.pause();
    }
  });

  return (
    <TouchableOpacity
      className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4"
      onPress={() => onPress(file)}
      style={{ height: 200 }}
      activeOpacity={0.8}
    >
      <View className="relative" style={{ height: 200 }}>
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
            width: 60,
            height: 60,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="play" size={30} color="white" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default AnnouncementPreviewScreen;
