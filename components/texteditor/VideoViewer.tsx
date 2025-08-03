import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';

interface VideoViewerProps {
  visible: boolean;
  videoUri: string;
  onClose: () => void;
  title?: string;
}

export default function VideoViewer({ 
  visible, 
  videoUri, 
  onClose, 
  title 
}: VideoViewerProps) {
  const videoPlayer = useVideoPlayer(
    visible ? videoUri : null,
    player => {
      if (player) {
        player.loop = false;
      }
    }
  );

  const { isPlaying } = useEvent(videoPlayer, 'playingChange', { 
    isPlaying: videoPlayer.playing 
  });

  // Reset video when modal closes
  React.useEffect(() => {
    if (!visible && videoPlayer) {
      videoPlayer.pause();
    }
  }, [visible, videoPlayer]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View style={styles.header}>
          {title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
        
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
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 15,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '80%',
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
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
});