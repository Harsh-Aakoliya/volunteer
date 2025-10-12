// components/chat/AudioMessagePlayer.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface AudioMessagePlayerProps {
  audioUrl: string;
  duration?: string;
  isOwn?: boolean;
  waves?: any[];
}

export default function AudioMessagePlayer({ 
  audioUrl, 
  duration = "0:00", 
  isOwn = false,
  waves = []
}: AudioMessagePlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAudio = async () => {
    if (sound) return;

    try {
      setIsLoading(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false }
      );
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis);
          setPlaybackDuration(status.durationMillis);
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      });

      setSound(newSound);
    } catch (error) {
      console.error('Error loading audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayback = async () => {
    if (!sound) {
      await loadAudio();
      return;
    }

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const getProgress = () => {
    if (playbackDuration === 0) return 0;
    return playbackPosition / playbackDuration;
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View className={`flex-row items-center p-3 rounded-2xl ${isOwn ? 'bg-green-500' : 'bg-gray-200'}`}>
      <TouchableOpacity 
        onPress={togglePlayback} 
        className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isOwn ? "#fff" : "#25D366"} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={isOwn ? "#fff" : "#25D366"}
          />
        )}
      </TouchableOpacity>

      <View className="flex-1 mr-3">
        <AudioWaveform
          waves={waves}
          isOwn={isOwn}
          progress={getProgress()}
          isPlaying={isPlaying}
          duration={playbackDuration}
        />
      </View>

      <Text className={`text-sm font-semibold ${isOwn ? 'text-white' : 'text-green-600'}`}>
        {formatTime(playbackDuration || 0) || duration}
      </Text>
    </View>
  );
}

// Audio Waveform Component
const AudioWaveform = ({ waves, isOwn, progress, isPlaying, duration }: any) => {
  const MAX_BARS = 100;
  const BAR_WIDTH = 2;
  const BAR_SPACING = 1;

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
      // Generate mock waveform if no wave data
      for (let i = 0; i < MAX_BARS; i++) {
        const height = Math.random() * 20 + 5;
        bars.push(
          <View
            key={`mock-${i}`}
            style={{
              width: BAR_WIDTH,
              height: height,
              backgroundColor: isOwn ? 'rgba(255,255,255,0.4)' : '#E0E0E0',
              marginRight: BAR_SPACING,
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
