import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

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
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.audioPlayer}>
          <View style={styles.audioIcon}>
            <Text style={styles.audioEmoji}>🎵</Text>
          </View>
          
          <Text style={styles.audioTitle}>
            {title || 'Audio File'}
          </Text>
          
          {size && (
            <Text style={styles.audioSubtitle}>
              Audio file - {formatBytes(size)}
            </Text>
          )}

          <View>
            <Text>Not supported Yet (will fix in next update)</Text>
          </View>
          
          {/* <View style={styles.audioControls}>
            <Text style={styles.audioNote}>
              Audio playback requires installing react-native-sound package.
            </Text>
            <Text style={styles.audioInstructions}>
              Run: npm install react-native-sound
            </Text>
            <Text style={styles.audioPath}>
              File: {audioUri}
            </Text>
          </View> */}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 50,
  },
  audioPlayer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  audioIcon: {
    width: 100,
    height: 100,
    backgroundColor: '#8b5cf6',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  audioEmoji: {
    fontSize: 40,
  },
  audioTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#374151',
  },
  audioSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 30,
    textAlign: 'center',
  },
  audioControls: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  audioNote: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  audioInstructions: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: 'monospace',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 6,
  },
  audioPath: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
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