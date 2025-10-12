// components/chat/AudioRecorder.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const { width: screenWidth } = Dimensions.get('window');

interface AudioRecorderProps {
  onRecordingComplete: (audioData: {
    file: string;
    duration: string;
    durationMillis: number;
    waves: any[];
  }) => void;
  onCancel: () => void;
  isVisible: boolean;
}

interface WaveData {
  id: string;
  height: number;
  pitch: number;
  timestamp: number;
  duration: number;
  rawPitch: number;
  position: number;
}

export default function AudioRecorder({ 
  onRecordingComplete, 
  onCancel, 
  isVisible 
}: AudioRecorderProps) {
  const [recording, setRecording] = useState<any>(undefined);
  const [recordingStatus, setRecordingStatus] = useState<any>({});
  const [isRecording, setIsRecording] = useState(false);
  const [waves, setWaves] = useState<WaveData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<any>(null);
  const [showReview, setShowReview] = useState(false);

  const MAX_VISIBLE_BARS = 80;
  const BAR_WIDTH = 3;
  const BAR_SPACING = 1;
  const containerWidth = screenWidth * 0.8;

  const totalBarWidth = BAR_WIDTH + BAR_SPACING;
  const maxBarsInContainer = Math.floor(containerWidth / totalBarWidth);

  // Color based on pitch level
  const getBarColor = (pitch: number) => {
    if (pitch > 0.7) return '#ff6b6b'; // High pitch - red
    if (pitch > 0.4) return '#4ecdc4'; // Medium pitch - teal
    if (pitch > 0.2) return '#45b7d1'; // Medium-low pitch - blue
    return '#25D366'; // Low pitch - green
  };

  const formatDuration = (milliseconds: number) => {
    if (milliseconds === undefined) return '0:00';
    const minutes = milliseconds / 1000 / 60;
    const seconds = Math.round((minutes - Math.floor(minutes)) * 60);
    return seconds < 10
      ? `${Math.floor(minutes)}:0${seconds}`
      : `${Math.floor(minutes)}:${seconds}`;
  };

  const renderWaveformBars = () => {
    const bars = [];

    if (waves.length > 0) {
      const visibleWaves = waves.slice(-maxBarsInContainer);

      for (let i = 0; i < maxBarsInContainer; i++) {
        const waveIndex = visibleWaves.length - maxBarsInContainer + i;
        const wave = waveIndex >= 0 ? visibleWaves[waveIndex] : null;

        bars.push(
          <Animated.View
            key={`wave-${i}-${wave?.id || i}`}
            style={{
              width: BAR_WIDTH,
              height: wave ? wave.height : 1,
              backgroundColor: wave ? getBarColor(wave.pitch) : 'rgba(255,255,255,0.1)',
              marginRight: BAR_SPACING,
              borderRadius: BAR_WIDTH / 2,
            }}
          />
        );
      }
    } else {
      for (let i = 0; i < maxBarsInContainer; i++) {
        bars.push(
          <Animated.View
            key={`empty-${i}`}
            style={{
              width: BAR_WIDTH,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.1)',
              marginRight: BAR_SPACING,
              borderRadius: BAR_WIDTH / 2,
            }}
          />
        );
      }
    }

  return bars;
};

// Audio Message Bubble Component (similar to audio.tsx)
const AudioMessageBubble = ({ recording, isOwn = true }: { recording: any, isOwn?: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis);
      setPlaybackDuration(status.durationMillis);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        recording.sound.stopAsync();
      }
    }
  };

  useEffect(() => {
    if (recording?.sound) {
      const sound = recording.sound;
      sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      return () => {
        sound.setOnPlaybackStatusUpdate(null);
      };
    }
  }, [recording]);

  const togglePlayback = async () => {
    if (isPlaying) {
      await recording.sound.pauseAsync();
    } else {
      await recording.sound.replayAsync();
    }
    setIsPlaying(!isPlaying);
  };

  const getProgress = () => {
    if (playbackDuration === 0) return 0;
    return playbackPosition / playbackDuration;
  };

  return (
    <View className={`flex-row items-center p-3 rounded-2xl ${isOwn ? 'bg-green-500' : 'bg-gray-200'}`}>
      <TouchableOpacity onPress={togglePlayback} className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3">
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={20}
          color={isOwn ? "#fff" : "#25D366"}
        />
      </TouchableOpacity>

      <View className="flex-1 mr-3">
        <CustomWaveform
          waves={recording.waves || []}
          isOwn={isOwn}
          progress={getProgress()}
          isPlaying={isPlaying}
          duration={playbackDuration}
        />
      </View>

      <Text className={`text-sm font-semibold ${isOwn ? 'text-white' : 'text-green-600'}`}>
        {formatDuration(playbackDuration || recording.durationMillis || 0)}
      </Text>
    </View>
  );
};

// Custom Waveform Component (similar to audio.tsx)
const CustomWaveform = ({ waves, isOwn, progress, isPlaying, duration }: any) => {
  const MAX_BARS = 100;
  const BAR_WIDTH = 2;
  const BAR_SPACING = 1;
  const containerWidth = 200;

  const getBarColor = (pitch: number, isPlayed: boolean) => {
    const baseColor = pitch > 0.7 ? '#ff6b6b' :
      pitch > 0.4 ? '#4ecdc4' :
        pitch > 0.2 ? '#45b7d1' : '#25D366';

    if (isPlayed) {
      return baseColor;
    } else {
      return isOwn ? 'rgba(255,255,255,0.3)' : '#E0E0E0';
    }
  };

  const renderWaveformBars = () => {
    const bars = [];

    if (waves && waves.length > 0) {
      const visibleWaves = waves.slice(-MAX_BARS);
      const currentPosition = progress * duration;

      for (let i = 0; i < MAX_BARS; i++) {
        const wave = visibleWaves[i] || null;
        const wavePosition = wave ? wave.position : 0;
        const isPlayed = wavePosition <= currentPosition;

        bars.push(
          <View
            key={`wave-${i}-${wave?.id || i}`}
            style={{
              width: BAR_WIDTH,
              height: wave ? Math.max(wave.height * 0.8, 3) : 3,
              backgroundColor: wave ? getBarColor(wave.pitch, isPlayed) : (isOwn ? 'rgba(255,255,255,0.2)' : '#E0E0E0'),
              marginRight: BAR_SPACING,
              opacity: wave ? 1 : 0.3,
              borderRadius: BAR_WIDTH / 2,
            }}
          />
        );
      }
    } else {
      for (let i = 0; i < MAX_BARS; i++) {
        bars.push(
          <View
            key={`empty-${i}`}
            style={{
              width: BAR_WIDTH,
              height: 3,
              backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : '#E0E0E0',
              marginRight: BAR_SPACING,
              opacity: 0.3,
              borderRadius: BAR_WIDTH / 2,
            }}
          />
        );
      }
    }

    return bars;
  };

  return (
    <View className="flex-row items-center justify-center">
      {renderWaveformBars()}
      {isPlaying && (
        <View className="absolute top-0 w-1 h-full bg-white rounded-full" style={{ left: `${progress * 100}%` }} />
      )}
    </View>
  );
};

const startRecording = async () => {
    try {
      // Stop any existing recording first
      if (recording) {
        if (typeof (recording as any).stopAndUnloadAsync === 'function') {
          await (recording as any).stopAndUnloadAsync();
        }
        setRecording(undefined);
      }

      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          outputFormat: 'MPEG4AAC',
          audioQuality: 'HIGH',
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          extension: '.m4a',
        },
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          extension: '.m4a',
          outputFormat: 'MPEG_4',
          audioEncoder: 'AAC',
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        }
      });

      newRecording.setOnRecordingStatusUpdate(status => {
        setRecordingStatus(status);

        // Add waveform data to waves array every 200ms
        if (status.isRecording && status.metering !== undefined) {
          const currentPitch = status.metering;
          const normalizedLevel = Math.max((currentPitch + 60) / 60, 0);

          const newWave: WaveData = {
            id: Date.now() + Math.random().toString(),
            height: Math.max(normalizedLevel * 50 + Math.random() * 10, 2),
            pitch: normalizedLevel,
            timestamp: Date.now(),
            duration: status.durationMillis || 0,
            rawPitch: currentPitch,
            position: status.durationMillis || 0
          };

          setWaves(prev => {
            const newWaves = [...prev, newWave];
            return newWaves.slice(-500);
          });
        }
      });

      setRecording(newRecording as any);
      setIsRecording(true);
      setRecordingStatus({ isRecording: true, metering: -60 });
      setWaves([]);

    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    setIsProcessing(true);
    
    try {
      await (recording as any).stopAndUnloadAsync();
      const { sound, status } = await (recording as any).createNewLoadedSoundAsync();
      console.log("recording, sound, status", recording, sound, status);
      
      const newRecording = {
        sound: sound,
        duration: formatDuration(status.durationMillis),
        durationMillis: status.durationMillis,
        file: (recording as any).getURI(),
        waves: [...waves],
      };
      
      console.log("audioData", newRecording);

      setCurrentRecording(newRecording);
      setShowReview(true);
      setRecording(undefined);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsProcessing(false);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
    }
  };

  const cancelRecording = async () => {
    if (recording) {
      try {
        await (recording as any).stopAndUnloadAsync();
      } catch (error) {
        console.error('Error canceling recording:', error);
      }
    }
    setRecording(undefined);
    setIsRecording(false);
    setWaves([]);
    setCurrentRecording(null);
    setShowReview(false);
    onCancel();
  };

  const sendRecording = () => {
    if (!currentRecording) return;
    
    const audioData = {
      file: currentRecording.file,
      duration: currentRecording.duration,
      durationMillis: currentRecording.durationMillis,
      waves: currentRecording.waves,
    };
    
    // Clean up the sound object
    currentRecording.sound?.unloadAsync?.();
    
    onRecordingComplete(audioData);
    setCurrentRecording(null);
    setShowReview(false);
  };

  const discardRecording = () => {
    if (!currentRecording) return;
    
    // Clean up the sound object
    currentRecording.sound?.unloadAsync?.();
    
    setCurrentRecording(null);
    setShowReview(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recording) {
        (recording as any).stopAndUnloadAsync?.();
      }
    };
  }, []);

  if (!isVisible) return null;

  const renderRecordingInterface = () => {
    if (showReview && currentRecording) {
      return (
        <View className="items-center">
          <Text className="text-lg font-bold text-gray-800 mb-4">Review Recording</Text>
          <AudioMessageBubble recording={currentRecording} isOwn={true} />
          <View className="flex-row items-center space-x-6 mt-6">
            <TouchableOpacity onPress={discardRecording} className="flex-row items-center px-4 py-2 bg-red-100 rounded-lg">
              <Ionicons name="trash" size={24} color="#ff4444" />
              <Text className="text-red-600 font-semibold ml-2">Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={sendRecording} className="flex-row items-center px-4 py-2 bg-green-500 rounded-lg">
              <Ionicons name="send" size={24} color="#fff" />
              <Text className="text-white font-semibold ml-2">Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (isRecording) {
      return (
        <View className="items-center">
          {/* Recording Header */}
          <View className="flex-row items-center justify-between w-full mb-4">
            <Text className="text-gray-600 text-sm">Recording...</Text>
            <Text className="text-lg font-bold text-gray-800">
              {formatDuration(recordingStatus.durationMillis)}
            </Text>
          </View>

          {/* Waveform */}
          <View className="w-full bg-gray-900 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-center">
              {renderWaveformBars()}
            </View>
          </View>

          {/* Recording Controls */}
          <View className="flex-row items-center space-x-6">
            <TouchableOpacity
              onPress={cancelRecording}
              className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center"
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={stopRecording}
              className="w-16 h-16 bg-red-500 rounded-full items-center justify-center"
            >
              <Ionicons name="stop" size={28} color="white" />
            </TouchableOpacity>

            <View className="w-12 h-12" />
          </View>
        </View>
      );
    }

    return (
      <View className="items-center">
        <TouchableOpacity
          onPress={startRecording}
          className="w-16 h-16 bg-green-500 rounded-full items-center justify-center mb-4"
        >
          <Ionicons name="mic" size={32} color="white" />
        </TouchableOpacity>
        <Text className="text-gray-600 mb-4">Tap to start recording</Text>
        <TouchableOpacity
          onPress={cancelRecording}
          className="px-4 py-2 bg-gray-200 rounded-lg"
        >
          <Text className="text-gray-700">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
      {isProcessing ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#25D366" />
          <Text className="text-gray-600 mt-2">Processing audio...</Text>
        </View>
      ) : (
        renderRecordingInterface()
      )}
    </View>
  );
}
