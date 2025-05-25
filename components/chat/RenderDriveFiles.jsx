import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Modal, ScrollView, SafeAreaView } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

const RenderDriveFiles = ({ mediaId, isOwnMessage = false }) => {
  const [driveFiles, setDriveFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioStates, setAudioStates] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  useEffect(() => {
    if (mediaId) {
      fetchMediaFiles();
    }
  }, [mediaId]);

  const fetchMediaFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://192.168.128.33:3000/api/media/getmedia/${mediaId}`);
      setDriveFiles(response.data.driveUrlObject || []);
      
      // Initialize audio states for audio files
      const initialAudioStates = {};
      response.data.driveUrlObject?.forEach((file, index) => {
        if (file.mimeType?.startsWith('audio/')) {
          initialAudioStates[index] = {
            sound: null,
            isPlaying: false,
            duration: 0,
            position: 0,
            isLoaded: false
          };
        }
      });
      setAudioStates(initialAudioStates);
    } catch (err) {
      console.error('Error fetching media files:', err);
      setError('Failed to load media files');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (millis) => {
    const seconds = Math.floor(millis / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderModalContent = () => {
    if (!driveFiles || driveFiles.length === 0) return null;
    
    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View className="flex-1 bg-black bg-opacity-90">
          <SafeAreaView className="flex-1">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 bg-black bg-opacity-50">
              <TouchableOpacity onPress={closeModal} className="p-2">
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
              <View className="flex-1 items-center">
                <Text className="text-white text-lg font-semibold">
                  {selectedMediaIndex + 1} of {driveFiles.length}
                </Text>
                <Text className="text-gray-300 text-sm" numberOfLines={1}>
                  {driveFiles[selectedMediaIndex]?.name}
                </Text>
              </View>
              <View className="w-12" />
            </View>

            {/* Media Content */}
            <ScrollView 
              horizontal 
              pagingEnabled 
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                setSelectedMediaIndex(index);
              }}
            >
              {driveFiles.map((file, index) => (
                <View key={index} style={{ width: screenWidth }} className="flex-1 justify-center items-center p-4">
                  {renderModalMediaItem(file, index)}
                </View>
              ))}
            </ScrollView>

            {/* Media Navigation Dots */}
            {driveFiles.length > 1 && (
              <View className="flex-row justify-center items-center py-4">
                {driveFiles.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedMediaIndex(index)}
                    className={`w-2 h-2 rounded-full mx-1 ${
                      index === selectedMediaIndex ? 'bg-white' : 'bg-gray-500'
                    }`}
                  />
                ))}
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    );
  };

  const renderModalMediaItem = (file, index) => {
    if (file.mimeType?.startsWith('image/')) {
      return (
        <View className="flex-1 justify-center">
          <Image
            source={{ uri: file.url }}
            style={{ 
              width: screenWidth - 32,
              height: screenWidth - 32,
              maxHeight: 400
            }}
            resizeMode="contain"
          />
          {file.caption && (
            <Text className="text-white text-center mt-4 px-4">
              {file.caption}
            </Text>
          )}
        </View>
      );
    } else if (file.mimeType?.startsWith('video/')) {
      return (
        <View className="flex-1 justify-center">
          <Video
            source={{ uri: file.url }}
            style={{ 
              width: screenWidth - 32,
              height: 300
            }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
          />
          {file.caption && (
            <Text className="text-white text-center mt-4 px-4">
              {file.caption}
            </Text>
          )}
        </View>
      );
    } else if (file.mimeType?.startsWith('audio/')) {
      return renderAudioFile(file, index, true);
    } else {
      return (
        <View className="bg-gray-800 p-6 rounded-lg items-center">
          <Ionicons name="document" size={64} color="white" />
          <Text className="text-white text-lg font-medium mt-4">{file.name}</Text>
          {file.caption && (
            <Text className="text-gray-300 text-center mt-2">{file.caption}</Text>
          )}
        </View>
      );
    }
  };
    try {
      const currentAudioState = audioStates[index];
      
      if (!currentAudioState.sound) {
        // Load and play audio
        const { sound } =  Audio.Sound.createAsync(
          { uri: fileUrl },
          { shouldPlay: true }
        );
        
        sound.setOnPlaybackStatusUpdate((status) => {
          setAudioStates(prev => ({
            ...prev,
            [index]: {
              ...prev[index],
              isPlaying: status.isPlaying || false,
              duration: status.durationMillis || 0,
              position: status.positionMillis || 0,
              isLoaded: status.isLoaded || false
            }
          }));
        });
        
        setAudioStates(prev => ({
          ...prev,
          [index]: {
            ...prev[index],
            sound,
            isPlaying: true
          }
        }));
      } else {
        // Toggle play/pause
        if (currentAudioState.isPlaying) {
          currentAudioState.sound.pauseAsync();
        } else {
          currentAudioState.sound.playAsync();
        }
      }
    } catch (error) {
      console.error('Error handling audio:', error);
      Alert.alert('Error', 'Failed to play audio file');
    }
  };

  const handleMediaPress = (index) => {
    if (onMediaPress) {
      onMediaPress(driveFiles, index);
    } else {
      setSelectedMediaIndex(index);
      setModalVisible(true);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    // Pause any playing audio when modal closes
    Object.values(audioStates).forEach(state => {
      if (state.sound && state.isPlaying) {
        state.sound.pauseAsync();
      }
    });
  };

  const handleAudioPress = async (fileUrl, index) => {
    return (
    <View key={index} className="mb-2">
      <Image
        source={{ uri: file.url }}
        className="w-full rounded-lg"
        style={{ 
          height: 200,
          maxWidth: screenWidth * 0.7
        }}
        resizeMode="cover"
      />
      {file.caption && (
        <Text className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-600'}`}>
          {file.caption}
        </Text>
      )}
    </View>
  );


  const renderVideoFile = (file, index) => (
    <TouchableOpacity key={index} onPress={() => handleMediaPress(index)} className="mb-2">
      <View className="relative">
        <Video
          source={{ uri: file.url }}
          style={{ 
            height: 180,
            borderRadius: 12
          }}
          useNativeControls={false}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
        />
        {/* Play button overlay */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="bg-black bg-opacity-50 rounded-full p-3">
            <Ionicons name="play" size={24} color="white" />
          </View>
        </View>
      </View>
      {file.caption && (
        <Text className={`text-xs mt-2 px-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-600'}`} numberOfLines={2}>
          {file.caption}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderAudioFile = (file, index, isModal = false) => {
    const audioState = audioStates[index] || {};
    
    return (
      <View key={index} className={`mb-2 p-4 rounded-xl ${
        isModal 
          ? 'bg-gray-800' 
          : isOwnMessage 
            ? 'bg-blue-400 bg-opacity-80' 
            : 'bg-gray-100'
      }`}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => handleAudioPress(file.url, index)}
            className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${
              isModal
                ? 'bg-blue-600'
                : isOwnMessage 
                  ? 'bg-blue-600' 
                  : 'bg-gray-300'
            }`}
          >
            <Ionicons
              name={audioState.isPlaying ? 'pause' : 'play'}
              size={24}
              color={isModal || isOwnMessage ? 'white' : 'black'}
            />
          </TouchableOpacity>
          
          <View className="flex-1">
            <Text className={`text-sm font-medium ${
              isModal 
                ? 'text-white' 
                : isOwnMessage 
                  ? 'text-white' 
                  : 'text-black'
            }`} numberOfLines={1}>
              {file.name}
            </Text>
            
            {audioState.duration > 0 && (
              <View className="flex-row items-center mt-2">
                <View className={`flex-1 h-1 rounded-full mr-3 ${
                  isModal
                    ? 'bg-gray-600'
                    : isOwnMessage 
                      ? 'bg-blue-300' 
                      : 'bg-gray-300'
                }`}>
                  <View
                    className={`h-1 rounded-full ${
                      isModal
                        ? 'bg-blue-400'
                        : isOwnMessage 
                          ? 'bg-white' 
                          : 'bg-blue-500'
                    }`}
                    style={{
                      width: `${(audioState.position / audioState.duration) * 100}%`
                    }}
                  />
                </View>
                <Text className={`text-xs ${
                  isModal
                    ? 'text-gray-300'
                    : isOwnMessage 
                      ? 'text-blue-100' 
                      : 'text-gray-500'
                }`}>
                  {formatDuration(audioState.position)} / {formatDuration(audioState.duration)}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {file.caption && (
          <Text className={`text-xs mt-3 ${
            isModal
              ? 'text-gray-300'
              : isOwnMessage 
                ? 'text-blue-100' 
                : 'text-gray-600'
          }`}>
            {file.caption}
          </Text>
        )}
      </View>
    );
  };

  const renderFile = (file, index) => {
    if (file.mimeType?.startsWith('image/')) {
      return renderImageFile(file, index);
    } else if (file.mimeType?.startsWith('video/')) {
      return renderVideoFile(file, index);
    } else if (file.mimeType?.startsWith('audio/')) {
      return renderAudioFile(file, index);
    } else {
      // Generic file
      return (
        <TouchableOpacity key={index} onPress={() => handleMediaPress(index)}>
          <View className={`mb-2 p-4 rounded-xl border-2 ${
            isOwnMessage 
              ? 'bg-blue-400 bg-opacity-80 border-blue-300' 
              : 'bg-gray-100 border-gray-200'
          }`}>
            <View className="flex-row items-center">
              <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${
                isOwnMessage ? 'bg-blue-500' : 'bg-gray-300'
              }`}>
                <Ionicons
                  name="document"
                  size={24}
                  color={isOwnMessage ? 'white' : 'gray'}
                />
              </View>
              <View className="flex-1">
                <Text className={`text-sm font-medium ${
                  isOwnMessage ? 'text-white' : 'text-black'
                }`} numberOfLines={1}>
                  {file.name}
                </Text>
                {file.caption && (
                  <Text className={`text-xs mt-1 ${
                    isOwnMessage ? 'text-blue-100' : 'text-gray-600'
                  }`} numberOfLines={2}>
                    {file.caption}
                  </Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isOwnMessage ? 'rgba(255,255,255,0.7)' : 'gray'}
              />
            </View>
          </View>
        </TouchableOpacity>
      );
    }
  };

  if (loading) {
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={isOwnMessage ? 'white' : 'gray'} />
        <Text className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
          Loading media...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`p-3 rounded-lg ${isOwnMessage ? 'bg-red-400' : 'bg-red-100'}`}>
        <Text className={`text-sm ${isOwnMessage ? 'text-white' : 'text-red-600'}`}>
          {error}
        </Text>
      </View>
    );
  }

  if (!driveFiles || driveFiles.length === 0) {
    return (
      <View className={`p-3 rounded-lg ${isOwnMessage ? 'bg-blue-400' : 'bg-gray-100'}`}>
        <Text className={`text-sm ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
          No media files found
        </Text>
      </View>
    );
  }

  return (
    <>
      <View className="mt-1">
        {driveFiles.map((file, index) => renderFile(file, index))}
      </View>
      {renderModalContent()}
    </>
  );
};


export default RenderDriveFiles;