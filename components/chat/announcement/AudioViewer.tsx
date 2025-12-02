import React, { useEffect, useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Audio } from 'expo-av';
import { AVPlaybackStatus } from 'expo-av';

interface AudioViewerProps {
  visible: boolean;
  audioUri: string;
  onClose: () => void;
  title?: string;
  size?: number;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function AudioViewer({ 
  visible, 
  audioUri, 
  onClose, 
  title,
  size 
}: AudioViewerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize Audio when modal opens
  useEffect(() => {
    if (visible) {
      loadAudio();
    } else {
      // Clean up when modal closes
      unloadAudio();
    }
    
    return () => {
      unloadAudio();
    };
  }, [visible, audioUri]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && sound && isPlaying) {
        // Pause audio when app goes to background
        sound.pauseAsync().catch(console.error);
      } else if (nextAppState === 'active' && sound) {
        // Reacquire audio focus when app becomes active
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          // interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          // interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        }).catch(console.error);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [sound, isPlaying]);

  const loadAudio = async () => {
    try {
      setIsLoading(true);
      
      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        // interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        // interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      });

      // Create and load sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false }
      );

      setSound(newSound);

      // Set up status update callback
      newSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis || 0);
          setDuration(status.durationMillis || 0);
          setIsPlaying(status.isPlaying || false);
        }
      });

    } catch (error) {
      console.error('Error loading audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const unloadAudio = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  };

  const togglePlayback = async () => {
    if (!sound) return;

    try {
      // Ensure audio mode is set before playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        // interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        // interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      });

      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        // Get the current status to ensure sound is loaded
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.playAsync();
        } else {
          console.error('Sound not loaded');
        }
      }
    } catch (error: any) {
      console.error('Error toggling playback:', error);
      
      // Handle specific audio focus errors
      if (error.message?.includes('AudioFocusNotAcquiredException')) {
        console.log('Audio focus lost, attempting to reload audio...');
        // Try to reload the audio
        await loadAudio();
      }
    }
  };

  const handleSeek = async (positionMillis: number) => {
    if (!sound) return;
    
    try {
      await sound.setPositionAsync(positionMillis);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    unloadAudio();
    onClose();
  };

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-gray-100">
        <View className="flex-row justify-end p-5 pt-12">
          <TouchableOpacity
            className="bg-black bg-opacity-60 px-4 py-2 rounded-full"
            onPress={handleClose}
          >
            <Text className="text-white text-base">Close</Text>
          </TouchableOpacity>
        </View>
        
        <View className="flex-1 justify-center items-center p-5">
          <View className="w-24 h-24 bg-purple-500 rounded-full justify-center items-center mb-5">
            <Text className="text-4xl">🎵</Text>
          </View>
          
          <Text className="text-xl font-bold mb-2 text-center text-gray-700">
            {title || 'Audio File'}
          </Text>
          
          {size && (
            <Text className="text-base text-gray-500 mb-8 text-center">
              Audio file - {formatBytes(size)}
            </Text>
          )}

          {isLoading ? (
            <ActivityIndicator size="large" color="#8b5cf6" className="mt-8" />
          ) : sound ? (
            <View className="flex-col items-center mt-8 w-full justify-center bg-white p-5 rounded-xl shadow-lg">
              {/* Progress bar */}
              <View className="flex-row items-center w-full mb-5">
                <Text className="text-xs text-gray-500 w-10 text-center">
                  {formatTime(position)}
                </Text>
                <TouchableOpacity 
                  className="flex-1 h-1 bg-gray-200 rounded-sm mx-2 relative"
                  onPress={(event) => {
                    const { locationX } = event.nativeEvent;
                    const progressBarWidth = 200;
                    const newPosition = (locationX / progressBarWidth) * duration;
                    handleSeek(newPosition);
                  }}
                >
                  <View 
                    className="h-full bg-purple-500 rounded-sm"
                    style={{ width: `${progressPercentage}%` }}
                  />
                  <View
                    className="absolute w-4 h-4 bg-purple-500 rounded-full -top-1.5 -ml-2"
                    style={{ left: `${progressPercentage}%` }}
                  />
                </TouchableOpacity>
                <Text className="text-xs text-gray-500 w-10 text-center">
                  {formatTime(duration)}
                </Text>
              </View>

              {/* Play/Pause button */}
              <TouchableOpacity
                className="w-16 h-16 rounded-full bg-purple-500 justify-center items-center shadow-lg"
                onPress={togglePlayback}
              >
                <Text className="text-2xl text-white">
                  {isPlaying ? '⏸️' : '▶️'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text className="text-base text-red-500 text-center mt-8">
              Failed to load audio
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}