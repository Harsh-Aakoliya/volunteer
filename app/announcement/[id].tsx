import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cssInterop } from "nativewind";
import { RichEditor } from 'react-native-pell-rich-editor';
import { VideoView, useVideoPlayer } from 'expo-video';
import { AuthStorage } from '@/utils/authStorage';
import { getAnnouncementDetails, markAsRead, toggleLike, deleteAnnouncement } from '@/api/admin';
import { API_URL } from '@/constants/api';
import { formatISTDate } from '@/utils/dateUtils';
import axios from 'axios';
import ImageViewer from '@/components/texteditor/ImageViewer';
import VideoViewer from '@/components/texteditor/VideoViewer';
import AudioViewer from '@/components/texteditor/AudioViewer';
import { Announcement, LikedUser, ReadUser } from "@/types/type";

const StyledRichEditor = cssInterop(RichEditor, {
  className: 'style'
});

const AnnouncementDetails = () => {
  const params = useLocalSearchParams();
  const announcementId = Number(params.id);
  
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [attachedMediaFiles, setAttachedMediaFiles] = useState<any[]>([]);
  const [isLiking, setIsLiking] = useState(false);
  
  // Media viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState<any>(null);
  const [showAudioViewer, setShowAudioViewer] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<any>(null);
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<any>(null);

  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadAnnouncementDetails();
    getCurrentUser();
  }, [announcementId]);

  const getCurrentUser = async () => {
    const userData = await AuthStorage.getUser();
    if (userData) {
      setCurrentUserId(userData.userId);
    }
  };

  const loadAnnouncementDetails = async () => {
    try {
      setIsLoading(true);
      const announcementData = await getAnnouncementDetails(announcementId);
      setAnnouncement(announcementData);
      
      // Mark as read if user hasn't read it
      if (announcementData && !hasUserRead(announcementData)) {
        await markAsRead(announcementId, currentUserId);
      }
      
      // Load media files
      await loadAnnouncementMediaFiles(announcementId);
    } catch (error) {
      console.error('Error loading announcement details:', error);
      Alert.alert('Error', 'Failed to load announcement details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnnouncementMediaFiles = async (id: number) => {
    try {
      const token = await AuthStorage.getToken();
      const response = await axios.get(
        `${API_URL}/api/announcements/${id}/media`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setAttachedMediaFiles(response.data.files || []);
      }
    } catch (error) {
      console.log("No media files found for announcement:", error);
      setAttachedMediaFiles([]);
    }
  };

  const hasUserRead = (announcement: Announcement) => {
    return announcement.readBy?.some(read => read.userId === currentUserId) || false;
  };

  const hasUserLiked = (announcement: Announcement) => {
    return announcement.likedBy?.some(like => like.userId === currentUserId) || false;
  };

  const handleToggleLike = async () => {
    if (!announcement || isLiking) return;
    
    try {
      setIsLiking(true);
      
      // Optimistically update the UI
      const currentlyLiked = hasUserLiked(announcement);
      let newLikedBy;
      
      if (currentlyLiked) {
        newLikedBy = announcement.likedBy?.filter(like => like.userId !== currentUserId) || [];
      } else {
        const newLike = {
          userId: currentUserId,
          fullName: 'You',
          likedAt: new Date().toISOString()
        };
        newLikedBy = [...(announcement.likedBy || []), newLike];
      }
      
      setAnnouncement({
        ...announcement,
        likedBy: newLikedBy
      });

      await toggleLike(announcement.id, currentUserId);
    } catch (error: any) {
      console.error("Error toggling like:", error);
      Alert.alert("Error", "Failed to update like. Please try again.");
      // Reload announcement to revert optimistic update
      loadAnnouncementDetails();
    } finally {
      setIsLiking(false);
    }
  };

  const handleEdit = () => {
    if (!announcement) return;
    
    router.push({
      pathname: "/create-announcement",
      params: {  
        announcementId: announcement.id,
        title: announcement.title,
        content: announcement.body,
        announcementMode: 'edit',
        hasCoverImage: announcement.hasCoverImage ? 'true' : 'false',
        departmentTags: announcement.departmentTag ? JSON.stringify(announcement.departmentTag) : ''
      }
    });
  };

  const handleDelete = () => {
    if (!announcement) return;
    
    Alert.alert(
      "Delete Announcement",
      "Are you sure you want to delete this announcement?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteAnnouncement(announcement.id);
              router.back();
            } catch (error) {
              console.error("Error deleting announcement:", error);
              Alert.alert("Error", "Failed to delete announcement");
            }
          }
        }
      ]
    );
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0284c7" />
          <Text className="text-gray-500 mt-4">Loading announcement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!announcement) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-600">Announcement not found</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4">
            <Text className="text-blue-600">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isAuthor = announcement.authorId === currentUserId;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="relative flex-row justify-center items-center px-4 py-3 border-b border-gray-200 bg-white">
        {/* Back Button - Absolutely positioned to left */}
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="absolute left-4 p-2 z-10"
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        {/* Title - Naturally centered */}
        <Text className="text-xl font-bold">Announcement</Text>
        
        {/* Edit and Delete buttons for authors - Absolutely positioned to right */}
        {isAuthor && (
          <View className="absolute right-4 flex-row items-center z-10">
            <TouchableOpacity onPress={handleEdit} className="mr-3 p-2">
              <Ionicons name="create-outline" size={20} color="#6b7280" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleDelete} className="p-2">
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
        <View className="px-4 py-2">
          <Text className="text-2xl font-bold text-gray-900 mb-1">{announcement.title}</Text>
          <Text className="text-sm text-gray-500 mb-2">
            By {announcement.authorName} • {formatISTDate(announcement.createdAt, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}  </Text>
          
          <StyledRichEditor
            className="bg-white"
            initialContentHTML={announcement.body}
            editorStyle={{
              contentCSSText: `
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 16px;
                margin: 0;
                border: none;
                padding: 0;//important
              `
            }}
            disabled
          />
        </View>
        </ScrollView>

        {/* Attached Media Files */}
        {attachedMediaFiles.length > 0 && (
          <View className="px-4 pb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-4">Attached Media Files</Text>
            {attachedMediaFiles.map(file => renderMediaItem(file))}
          </View>
        )}

        {/* Like Button for Non-Authors */}
        {!isAuthor && (
          <View className="px-4 py-4 border-t border-gray-200 bg-white">
            <TouchableOpacity
              onPress={handleToggleLike}
              disabled={isLiking}
              className="flex-row items-center justify-center py-3"
            >
              <Ionicons 
                name={hasUserLiked(announcement) ? "heart" : "heart-outline"} 
                size={24} 
                color={isLiking ? "#9ca3af" : (hasUserLiked(announcement) ? "#ef4444" : "#6b7280")} 
              />
              <Text className="ml-2 text-gray-700">
                {hasUserLiked(announcement) ? 'Liked' : 'Like'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

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
  announcementId: number; 
  onPress: (file: any) => void;
}> = ({ file, announcementId, onPress }) => {
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
  announcementId: number;
  onPress: (file: any) => void;
}> = ({ file, announcementId, onPress }) => {
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

export default AnnouncementDetails;
