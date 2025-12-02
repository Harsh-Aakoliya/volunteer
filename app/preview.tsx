//preview.tsx
import * as React from "react"
import { useState } from 'react';
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
import { VideoView, useVideoPlayer } from 'expo-video';
import { publishDraft, scheduleDraft, rescheduleAnnouncement, updateAnnouncement } from '@/api/admin';
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import { formatISTDate } from '@/utils/dateUtils';
import axios from 'axios';
import ImageViewer from '@/components/chat/announcement/ImageViewer';
import VideoViewer from '@/components/chat/announcement/VideoViewer';
import AudioViewer from '@/components/chat/announcement/AudioViewer';
import DateTimePicker from '@/components/chat/DateTimePicker';
import { WebView } from 'react-native-webview';
const AnnouncementPreviewScreen = () => {
  const params = useLocalSearchParams();
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishingAnimation, setShowPublishingAnimation] = useState(false);
  const [contentHeight, setContentHeight] = useState(200);
  
  // Scheduling states
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  
  // Extract params
  const title = params.title as string || '';
  const content = params.content as string || '';
  const authorName = params.authorName as string || '';
  const announcementId = params.announcementId ? Number(params.announcementId) : undefined;
  const announcementMode = params.announcementMode as string || 'new';
  const attachedMediaFiles = params.attachedMediaFiles ? JSON.parse(params.attachedMediaFiles as string) : [];
  const roomId = params.roomId as string; // Get roomId if coming from chat

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


  const handleBackToEdit = () => {
    console.log("announcementId", announcementId);
    console.log("title", title);
    console.log("content", content);
    console.log("announcementMode", announcementMode);
    console.log("attachedMediaFiles", attachedMediaFiles);
    console.log("hasCoverImage", params.hasCoverImage);
    console.log("authorName", authorName);
    console.log("roomId", roomId);
    
    // Navigate back to create-announcement with current content preserved
    router.replace({
      pathname: "../create-announcement",
      params: {
        announcementId: announcementId,
        title: title,
        content: content,
        announcementMode: announcementMode,
        hasCoverImage: params.hasCoverImage || 'false',
        roomId: roomId
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
        >
          <Image
            source={{ uri: `${API_URL}/media/announcement/${announcementId}/media/${file.fileName}` }}
            style={{ 
              width: '100%', 
              aspectRatio: 1,
              alignSelf: 'center'
            }}
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
                await updateAnnouncement(announcementId, title, content, []);
              } else {
                await publishDraft(announcementId as number, title, content, user.userId, []);
              }
              
              setTimeout(() => {
                setShowPublishingAnimation(false);
                setIsPublishing(false);
                // Navigate back to announcement list
                router.replace(`/chat/${roomId}`);
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

  const handleSchedule = () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please select both date and time to schedule the announcement.');
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    if (scheduledDateTime <= new Date()) {
      Alert.alert('Error', 'Scheduled time must be in the future.');
      return;
    }

    setShowSchedulePicker(false);
    Alert.alert(
      'Schedule Announcement',
      `Are you sure you want to schedule this announcement for ${scheduledDateTime.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule',
          onPress: () => performSchedule(scheduledDateTime.toISOString())
        }
      ]
    );
  };

  const handleSendToChatRoom = async () => {
    if (isPublishing || isScheduling || !roomId) return;

    Alert.alert(
      "Send to Chat Room",
      "Are you sure you want to send this announcement to the chat room?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Send", 
          style: "default",
          onPress: async () => {
            try {
              setIsPublishing(true);
              setShowPublishingAnimation(true);
              
              const user = await AuthStorage.getUser();
              if (!user || !user.userId) {
                throw new Error('User not found');
              }

              const token = await AuthStorage.getToken();
              if (!token) {
                throw new Error('No authentication token');
              }

              // Format announcement content as JSON
              const announcementData = {
                title,
                body: content,
                attachedMediaFiles: attachedMediaFiles || []
              };

              // Send announcement as message to chat room
              const response = await axios.post(
                `${API_URL}/api/chat/rooms/${roomId}/messages`,
                {
                  messageText: JSON.stringify(announcementData),
                  messageType: 'announcement',
                  mediaFilesId: null,
                  pollId: null,
                  tableId: null,
                  replyMessageId: null
                },
                {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                }
              );

              setTimeout(() => {
                setShowPublishingAnimation(false);
                setIsPublishing(false);
                // Navigate back to chat room
                router.replace(`/chat/${roomId}`);
              }, 2000);
              
            } catch (error) {
              setIsPublishing(false);
              setShowPublishingAnimation(false);
              console.error('Error sending to chat room:', error);
              Alert.alert('Error', 'Failed to send announcement to chat room. Please try again.');
            }
          }
        }
      ]
    );
  };

  const performSchedule = async (scheduledAt: string) => {
    try {
      setIsScheduling(true);
      setShowPublishingAnimation(true);
      
      const user = await AuthStorage.getUser();
      if (!user) {
        throw new Error('User not found');
      }
      
      if (isEdit) {
        await rescheduleAnnouncement(
          announcementId as number,
          title,
          content,
          user.userId,
          [],
          scheduledAt
        );
      } else {
        await scheduleDraft(
          announcementId as number,
          title,
          content,
          user.userId,
          [],
          scheduledAt
        );
      }
      
      setTimeout(() => {
        setShowPublishingAnimation(false);
        setIsScheduling(false);
        router.replace(`/chat/${roomId}`);
      }, 2000);
      
    } catch (error) {
      setIsScheduling(false);
      setShowPublishingAnimation(false);
      console.error('Scheduling error:', error);
      Alert.alert('Error', 'Failed to schedule announcement. Please try again.');
    }
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
          <Text className="text-3xl font-bold text-gray-900 mb-1">{title}</Text>
          <Text className="text-sm text-gray-500 mb-2">
            By {authorName} • {formatISTDate(new Date(), { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}  </Text>
          <View className="bg-gray-100 h-px mb-2"></View>
          
            <WebView
              source={{ html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 20px;
                    line-height: 0;
                    margin: 0;
                    padding: 0;
                    color: #374151;
                  }
                  p {
                    margin: 0 0 0.5em 0;
                    line-height: 1.2;
                  }
                    h1, h2, h3, h4, h5, h6 {
                      margin: 0.5em 0 0.25em 0;
                      line-height: 1;
                    }
                    ul, ol {
                      margin: 0em 0;
                      padding-left: 1.5em;
                    }
                    li {
                      margin: 0.25em 0;
                      line-height: 1;
                    }
                    strong, b {
                      font-weight: 600;
                    }
                    em, i {
                      font-style: italic;
                    }
                  </style>
                </head>
                <body>
                  ${content}
                </body>
                <script>
                  function sendHeight() {
                    const height = Math.max(document.body.scrollHeight, document.body.offsetHeight);
                    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'contentHeight', height: height}));
                  }
                  
                  // Send height when content loads
                  window.addEventListener('load', sendHeight);
                  document.addEventListener('DOMContentLoaded', sendHeight);
                  
                  // Also send height after a short delay to ensure content is fully rendered
                  setTimeout(sendHeight, 100);
                </script>
              ` }}
              style={{ 
                height: contentHeight, 
                backgroundColor: 'transparent',
                marginVertical: 8
              }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'contentHeight') {
                    setContentHeight(data.height + 20); // Add some padding
                  }
                } catch (error) {
                  console.log('Error parsing WebView message:', error);
                }
              }}
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

      {/* Fixed Action Buttons */}
      <View className="p-4 bg-white border-t border-gray-200">
        {roomId ? (
          // Show "Send to chat room" button if roomId is provided
          <TouchableOpacity
            onPress={handleSendToChatRoom}
            disabled={isPublishing || isScheduling}
            className={`py-3 px-6 rounded-lg ${
              isPublishing || isScheduling ? 'bg-gray-400' : 'bg-blue-600'
            }`}
          >
            <Text className="text-white text-center font-semibold">
              {isPublishing 
                ? 'Sending...' 
                : 'Send to Chat Room'
              }
            </Text>
          </TouchableOpacity>
        ) : (
          // Show publish button if no roomId
          <TouchableOpacity
            onPress={handlePublish}
            disabled={isPublishing || isScheduling}
            className={`py-3 px-6 rounded-lg ${
              isPublishing || isScheduling ? 'bg-gray-400' : 'bg-green-600'
            }`}
          >
            <Text className="text-white text-center font-semibold">
              {isPublishing 
                ? 'Publishing...' 
                : isEdit ? 'Update Announcement' : 'Publish Announcement'
              }
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Schedule Picker Modal */}
      {showSchedulePicker && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={showSchedulePicker}
          onRequestClose={() => setShowSchedulePicker(false)}
        >
          <View className="flex-1 bg-black/50 justify-center">
            <View className="bg-white mx-6 rounded-2xl p-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-800">
                  {isEdit ? 'Reschedule Announcement' : 'Schedule Announcement'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowSchedulePicker(false);
                    setSelectedDate(null);
                    setSelectedTime(null);
                  }}
                  className="p-2"
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text className="text-gray-600 mb-4">
                Select when you want to {isEdit ? 'reschedule' : 'schedule'} this announcement.
              </Text>

              <DateTimePicker
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedTime={selectedTime}
                setSelectedTime={setSelectedTime}
                containerClassName="mb-6"
              />

              <View className="flex-row justify-between space-x-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowSchedulePicker(false);
                    setSelectedDate(null);
                    setSelectedTime(null);
                  }}
                  className="flex-1 py-3 px-6 rounded-lg border border-gray-300"
                >
                  <Text className="text-gray-700 text-center font-semibold">Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleSchedule}
                  disabled={!selectedDate || !selectedTime || isScheduling}
                  className={`flex-1 py-3 px-6 rounded-lg ${
                    selectedDate && selectedTime && !isScheduling
                      ? 'bg-yellow-600'
                      : 'bg-gray-400'
                  }`}
                >
                  <Text className="text-white text-center font-semibold">
                    {isScheduling 
                      ? 'Scheduling...' 
                      : isEdit ? 'Reschedule' : 'Schedule'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

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
      style={{ height: 100 }}
    >
      <View className="flex-row items-center h-full px-4">
        <View className="w-16 h-16 bg-purple-100 rounded-lg items-center justify-center mr-4">
          <Ionicons name="musical-notes" size={32} color="#8b5cf6" />
        </View>
        
        <View className="flex-1">
          <Text className="font-semibold text-gray-900" numberOfLines={1}>
            {file.originalName || file.fileName}
          </Text>
          <Text className="text-sm text-gray-600">Audio file • Tap to play</Text>
        </View>
        
        <TouchableOpacity
          onPress={() => onPress(file)}
          className="items-center justify-center"
        >
          <Ionicons name="play-circle" size={40} color="#8b5cf6" />
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
      activeOpacity={0.8}
    >
      <View className="relative">
        <VideoView
          style={{ 
            width: '100%', 
            height: 250,
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
            width: 80,
            height: 80,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="play" size={40} color="white" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default AnnouncementPreviewScreen;
