import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useEvent } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import Sound from "react-native-sound"; // Commented out until package is installed
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import axios from "axios";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MediaFile {
  url: string;
  filename: string;
  originalName: string;
  caption: string;
  mimeType: string;
  size: number;
}

interface MediaData {
  id: number;
  roomId: number;
  senderId: string;
  createdAt: string;
  messageId: number;
  files: MediaFile[];
}

interface MediaViewerModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId: number;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatAudioTime = (millis: number) => {
  if (!millis) return '0:00';
  const minutes = Math.floor(millis / 60000);
  const seconds = Math.floor((millis % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function MediaViewerModal({ visible, onClose, mediaId }: MediaViewerModalProps) {
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [fileLoadingStates, setFileLoadingStates] = useState<Record<number, boolean>>({});
  
  // Audio player state
  const [audioSound, setAudioSound] = useState<any>(null); // Changed to any as Sound is removed
  const [audioStatus, setAudioStatus] = useState<any>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);

  // Get auth headers
  useEffect(() => {
    // Configure audio session for better playback
    const configureAudioSession = async () => {
      try {
        // Enable playback in silent mode
        // Sound.setCategory('Playback'); // Removed as Sound is removed
      } catch (error) {
        console.error("Error configuring audio session:", error);
      }
    };
    
    if (visible) {
      configureAudioSession();
    }
  }, [visible]);

  // Fetch media data when modal opens
  useEffect(() => {
    if (visible && mediaId) {
      fetchMediaData();
    }
  }, [visible, mediaId]);

  // Video player for current video
  const currentFile = mediaData?.files[currentFileIndex];
  const videoPlayer = useVideoPlayer(
    currentFile?.mimeType.startsWith("video") 
      ? `${API_URL}/media/chat/${currentFile.url}` 
      : null,
    player => {
      if (player) {
        player.loop = false; // Don't loop by default
        // Don't autoplay by default
      }
    }
  );

  // Video player state
  const { isPlaying } = useEvent(videoPlayer, 'playingChange', { 
    isPlaying: videoPlayer.playing 
  });

  // Audio player functions
  const loadAudio = async (audioUrl: string) => {
    try {
      // Unload previous audio if exists
      if (audioSound) {
        // audioSound.stop(); // Removed as Sound is removed
        // audioSound.release(); // Removed as Sound is removed
        setAudioSound(null);
      }

      // Clear any existing progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
        setProgressInterval(null);
      }

      // const sound = new Sound( // Removed as Sound is removed
      //   `${API_URL}/media/chat/${audioUrl}`,
      //   '',
      //   (error) => {
      //     if (error) {
      //       console.error("Error loading audio:", error);
      //       Alert.alert("Error", "Failed to load audio file");
      //     } else {
      //       setAudioSound(sound);
      //       setDuration(sound.getDuration());
      //       setCurrentTime(0);
      //       setIsAudioPlaying(false);
      //     }
      //   }
      // );
      
    } catch (error) {
      console.error("Error loading audio:", error);
      Alert.alert("Error", "Failed to load audio file");
    }
  };

  const toggleAudioPlayback = async () => {
    if (!audioSound) return;
    
    try {
      if (isAudioPlaying) {
        // audioSound.pause(); // Removed as Sound is removed
        setIsAudioPlaying(false);
        if (progressInterval) {
          clearInterval(progressInterval);
          setProgressInterval(null);
        }
      } else {
        // audioSound.play((success) => { // Removed as Sound is removed
        //   if (success) {
        //     console.log("Audio finished playing");
        //     setIsAudioPlaying(false);
        //     setCurrentTime(0);
        //     if (progressInterval) {
        //       clearInterval(progressInterval);
        //       setProgressInterval(null);
        //     }
        //   }
        // });
        setIsAudioPlaying(true);
        
        // Start progress tracking
        const interval = setInterval(() => {
          if (audioSound && isAudioPlaying) {
            // audioSound.getCurrentTime((seconds) => { // Removed as Sound is removed
            //   setCurrentTime(seconds);
            // });
          }
        }, 1000);
        setProgressInterval(interval);
      }
    } catch (error) {
      console.error("Error toggling audio playback:", error);
    }
  };

  // Cleanup audio when modal closes or file changes
  useEffect(() => {
    if (!visible) {
      if (audioSound) {
        // audioSound.stop(); // Removed as Sound is removed
        // audioSound.release(); // Removed as Sound is removed
        setAudioSound(null);
        setAudioStatus(null);
        setIsAudioPlaying(false);
      }
      if (progressInterval) {
        clearInterval(progressInterval);
        setProgressInterval(null);
      }
      setCurrentTime(0);
      setDuration(0);
    }
  }, [visible]);

  // Load audio when audio file is selected
  useEffect(() => {
    if (currentFile?.mimeType.startsWith("audio")) {
      loadAudio(currentFile.url);
    } else {
      // Clean up audio if switching to non-audio file
      if (audioSound) {
        // audioSound.stop(); // Removed as Sound is removed
        // audioSound.release(); // Removed as Sound is removed
        setAudioSound(null);
        setAudioStatus(null);
        setIsAudioPlaying(false);
      }
      if (progressInterval) {
        clearInterval(progressInterval);
        setProgressInterval(null);
      }
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentFile]);

  const fetchMediaData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AuthStorage.getToken();
      console.log(`Fetching media data for ID: ${mediaId}`);
      
      const response = await axios.get(
        `${API_URL}/api/vm-media/media/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setMediaData(response.data.media);
        setCurrentFileIndex(0);
        // Initialize loading states for all files
        const initialLoadingStates: Record<number, boolean> = {};
        response.data.media.files.forEach((_: any, index: number) => {
          initialLoadingStates[index] = true;
        });
        setFileLoadingStates(initialLoadingStates);
        console.log(`Loaded ${response.data.media.files.length} files`);
      } else {
        setError("Failed to load media files");
      }
    } catch (error: any) {
      console.error("Error fetching media:", error);
      setError(error.response?.data?.error || "Failed to load media files");
    } finally {
      setLoading(false);
    }
  };

  const handleFileLoad = (index: number) => {
    setFileLoadingStates(prev => ({
      ...prev,
      [index]: false
    }));
  };

  const handleFileError = (index: number) => {
    setFileLoadingStates(prev => ({
      ...prev,
      [index]: false
    }));
    Alert.alert("Error", "Failed to load media file");
  };

  const navigateFile = (direction: 'prev' | 'next') => {
    if (!mediaData) return;
    
    if (direction === 'next' && currentFileIndex < mediaData.files.length - 1) {
      setCurrentFileIndex(prev => prev + 1);
    } else if (direction === 'prev' && currentFileIndex > 0) {
      setCurrentFileIndex(prev => prev - 1);
    }
  };

  const renderCurrentFile = () => {
    if (!mediaData || !currentFile) return null;

    const isImage = currentFile.mimeType.startsWith("image");
    const isVideo = currentFile.mimeType.startsWith("video");
    const isAudio = currentFile.mimeType.startsWith("audio");
    const isLoading = fileLoadingStates[currentFileIndex];

    return (
      <View style={styles.mediaContainer}>
        {/* Loading indicator - only for images */}
        {isLoading && isImage && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0284c7" />
            <Text style={styles.loadingText}>Loading {currentFile.originalName}...</Text>
          </View>
        )}

        {/* Image */}
        {isImage && (
          <ScrollView
            style={styles.imageScrollView}
            contentContainerStyle={styles.imageContainer}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            <Image
              source={{
                uri: `${API_URL}/media/chat/${currentFile.url}`
              }}
              style={styles.image}
              resizeMode="contain"
              onLoad={() => handleFileLoad(currentFileIndex)}
              onError={() => handleFileError(currentFileIndex)}
            />
          </ScrollView>
        )}

        {/* Video */}
        {isVideo && (
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
        )}

        {/* Audio */}
        {isAudio && (
          <View style={styles.audioContainer}>
            <Text style={styles.audioIcon}>🎵</Text>
            <Text style={styles.audioTitle}>{currentFile.originalName}</Text>
            <Text style={styles.audioSubtitle}>{formatBytes(currentFile.size)}</Text>
            
            {/* Audio Controls - Placeholder */}
            <View style={styles.audioControls}>
              <Text style={styles.audioNote}>
                Audio playback requires installing react-native-sound package.
              </Text>
              <Text style={styles.audioInstructions}>
                Run: npm install react-native-sound
              </Text>
            </View>
          </View>
        )}

        {/* File info */}
        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>{currentFile.originalName}</Text>
          <Text style={styles.fileDetails}>
            {formatBytes(currentFile.size)} • {currentFile.mimeType}
          </Text>
          {currentFile.caption && (
            <Text style={styles.caption}>{currentFile.caption}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderFileNavigation = () => {
    if (!mediaData || mediaData.files.length <= 1) return null;

    return (
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[styles.navButton, currentFileIndex === 0 && styles.navButtonDisabled]}
          onPress={() => navigateFile('prev')}
          disabled={currentFileIndex === 0}
        >
          <Text style={styles.navButtonText}>◀ Previous</Text>
        </TouchableOpacity>

        <View style={styles.fileCounter}>
          <Text style={styles.counterText}>
            {currentFileIndex + 1} of {mediaData.files.length}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.navButton, currentFileIndex === mediaData.files.length - 1 && styles.navButtonDisabled]}
          onPress={() => navigateFile('next')}
          disabled={currentFileIndex === mediaData.files.length - 1}
        >
          <Text style={styles.navButtonText}>Next ▶</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Media Files</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0284c7" />
            <Text style={styles.loadingText}>Loading media files...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchMediaData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : mediaData ? (
          <>
            {renderCurrentFile()}
            {renderFileNavigation()}
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  mediaContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
    width: screenWidth,
    height: screenHeight * 0.6,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  video: {
    width: screenWidth,
    height: screenHeight * 0.6,
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
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  audioIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  audioTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  audioSubtitle: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 10,
  },
  audioNote: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  audioInstructions: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  fileInfo: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
  },
  fileName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  fileDetails: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  caption: {
    color: 'white',
    fontSize: 15,
    fontStyle: 'italic',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  navButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  navButtonDisabled: {
    backgroundColor: '#666',
  },
  navButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  fileCounter: {
    flex: 1,
    alignItems: 'center',
  },
  counterText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  audioControls: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 20,
  },
  audioPlayButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  audioPlayButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  audioProgress: {
    flex: 1,
    marginLeft: 10,
  },
  audioTime: {
    color: 'white',
    fontSize: 14,
    marginBottom: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#555',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 4,
  },
}); 