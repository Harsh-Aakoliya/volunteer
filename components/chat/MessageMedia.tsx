import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, ScrollView } from 'react-native';
import { Video, ResizeMode } from "expo-av";
import { MediaFile } from '@/types/type';
import { Audio } from "expo-av";

interface MessageMediaProps {
  mediaFiles: MediaFile[];
  maxDisplayCount?: number;
}

// Audio player component
const AudioPlayer = ({ uri }: { uri: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let isMounted = true;
    
    const loadSound = async () => {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync({ uri });
        
        if (isMounted) {
          setSound(newSound);
          setLoading(false);
          
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
            }
          });
        }
      } catch (error) {
        console.error("Failed to load audio:", error);
        if (isMounted) setLoading(false);
      }
    };

    loadSound();
    
    return () => {
      isMounted = false;
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [uri]);

  const togglePlayback = async () => {
    if (!sound) return;
    
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  return (
    <View className="h-10 w-full justify-center items-center bg-gray-800 rounded-lg">
      <TouchableOpacity 
        onPress={togglePlayback}
        className="flex-row items-center px-3"
      >
        <Text className="text-white mr-2">
          {loading ? "Loading..." : isPlaying ? "Pause" : "Play"}
        </Text>
        <Text className="text-white text-xl">
          {loading ? "⏳" : isPlaying ? "⏸️" : "▶️"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// Media preview modal
const MediaPreviewModal = ({ 
  visible, 
  file, 
  onClose 
}: { 
  visible: boolean; 
  file: MediaFile | null; 
  onClose: () => void;
}) => {
  if (!file) return null;

  const isImage = file.mimeType.startsWith("image");
  const isAudio = file.mimeType.startsWith("audio");
  const isVideo = file.mimeType.startsWith("video");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
    >
      <View className="flex-1 justify-center items-center bg-black/75">
        <View className="bg-white w-11/12 rounded-xl p-4 max-h-3/4">
          <Text className="text-xl font-bold mb-4 text-center">{file.name}</Text>
          
          <View className="mb-4 items-center">
            {isImage && (
              <Image 
                source={{ uri: file.url }} 
                className="w-full h-64 rounded-lg" 
                resizeMode="contain"
              />
            )}
            
            {isVideo && (
              <Video
                source={{ uri: file.url }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                className="w-full h-64 rounded-lg"
              />
            )}
            
            {isAudio && <AudioPlayer uri={file.url} />}
          </View>
          
          <TouchableOpacity 
            onPress={onClose}
            className="bg-red-500 py-2 rounded-lg"
          >
            <Text className="text-white font-bold text-center">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const MessageMedia: React.FC<MessageMediaProps> = ({ 
  mediaFiles, 
  maxDisplayCount = 3 
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);

  const openPreview = (file: MediaFile) => {
    setSelectedFile(file);
    setModalVisible(true);
  };

  const closePreview = () => {
    setModalVisible(false);
    setSelectedFile(null);
  };

  if (!mediaFiles || mediaFiles.length === 0) {
    return null;
  }

  // Display up to maxDisplayCount files inline, then a "+X more" button if there are more
  const displayFiles = mediaFiles.slice(0, maxDisplayCount);
  const hasMore = mediaFiles.length > maxDisplayCount;
  const moreCount = mediaFiles.length - maxDisplayCount;

  return (
    <View className="mt-1">
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View className="flex-row">
          {displayFiles.map((file, index) => {
            const isImage = file.mimeType.startsWith("image");
            const isAudio = file.mimeType.startsWith("audio");
            const isVideo = file.mimeType.startsWith("video");
            
            return (
              <TouchableOpacity 
                key={file.id || index} 
                onPress={() => openPreview(file)}
                className="mr-2"
              >
                <View className="w-16 h-16 rounded-lg overflow-hidden justify-center items-center">
                  {isImage && (
                    <Image 
                      source={{ uri: file.url }} 
                      className="w-full h-full" 
                      resizeMode="cover"
                    />
                  )}
                  {isAudio && (
                    <View className="bg-purple-500 w-full h-full justify-center items-center">
                      <Text className="text-white text-xl">🎵</Text>
                    </View>
                  )}
                  {isVideo && (
                    <View className="bg-red-500 w-full h-full justify-center items-center">
                      <Text className="text-white text-xl">🎬</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          
          {hasMore && (
            <TouchableOpacity 
              onPress={() => {
                // Show the first hidden file when clicking "+X more"
                openPreview(mediaFiles[maxDisplayCount]);
              }}
              className="w-16 h-16 bg-gray-700 rounded-lg justify-center items-center"
            >
              <Text className="text-white font-bold">+{moreCount}</Text>
              <Text className="text-white text-xs">more</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      
      {/* Preview modal */}
      <MediaPreviewModal
        visible={modalVisible}
        file={selectedFile}
        onClose={closePreview}
      />
    </View>
  );
};

export default MessageMedia; 