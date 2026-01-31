// components/chat/AudioMessagePlayer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { API_URL } from '@/constants/api';

interface AudioMessagePlayerProps {
  /** Full URL to the audio file (e.g. `${API_URL}/media/chat/${fileName}`) */
  audioUrl: string;
  /** Optional duration in seconds (for display); if not provided we load to get it */
  durationSeconds?: number;
  isOwnMessage?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function AudioMessagePlayer({
  audioUrl,
  durationSeconds: initialDuration,
  isOwnMessage = false,
}: AudioMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(initialDuration ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Load audio to get duration (without playing) so we show total length initially
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    const loadDuration = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false }
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis != null) {
          setDurationSeconds(status.durationMillis / 1000);
        }
        await sound.unloadAsync();
      } catch (_) {}
    };
    loadDuration();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  const loadAndPlay = async () => {
    if (!audioUrl) return;
    setLoading(true);
    setError(false);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 300 },
        (status) => {
          if (!status.isLoaded) return;
          setPositionSeconds((status.positionMillis ?? 0) / 1000);
          if (status.durationMillis != null) {
            setDurationSeconds(status.durationMillis / 1000);
          }
          const didFinish = (status as any).didJustFinishAndNotJustLooped ?? (status as any).didJustFinish;
          if (didFinish) {
            setPositionSeconds(0);
            setIsPlaying(false);
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
      console.error('AudioMessagePlayer load error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (loading) return;
    if (error) {
      loadAndPlay();
      return;
    }
    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (soundRef.current) {
      // Replay from start: seek to 0 then play so relistening works
      try {
        await soundRef.current.setPositionAsync(0);
        setPositionSeconds(0);
      } catch (_) {}
      await soundRef.current.playAsync();
      setIsPlaying(true);
      return;
    }
    loadAndPlay();
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [audioUrl]);

  const progress = durationSeconds > 0 ? positionSeconds / durationSeconds : 0;

  return (
    <View
      style={{
        width: 260,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginVertical: 4,
      }}
    >
      {/* Top row: play button, progress bar, time (duration when idle, position when playing) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <TouchableOpacity
          onPress={togglePlayPause}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#e5e7eb',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#374151" />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color="#374151"
            />
          )}
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
            height: 4,
            backgroundColor: '#e5e7eb',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: '#16a34a',
              borderRadius: 2,
            }}
          />
        </View>

        <Text
          style={{
            marginLeft: 10,
            fontSize: 13,
            fontWeight: '600',
            color: '#374151',
            minWidth: 36,
          }}
        >
          {isPlaying ? formatTime(positionSeconds) : formatTime(durationSeconds)}
        </Text>
      </View>

      {error && (
        <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
          Failed to load audio
        </Text>
      )}
    </View>
  );
}
