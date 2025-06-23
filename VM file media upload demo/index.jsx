import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Video } from 'expo-av';
import { Audio } from 'expo-av';

const VM_BASE_URL = "http://192.168.120.33:8080";
const LOCAL_FOLDER_URI = "content://com.android.externalstorage.documents/tree/primary%3ASevak";

export default function MediaManagerApp() {
  const [activeTab, setActiveTab] = useState('media');
  const [vmFiles, setVmFiles] = useState([]);
  const [localFiles, setLocalFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioStatus, setAudioStatus] = useState({});
  const [sound, setSound] = useState(null);

  useEffect(() => {
    if (activeTab === 'media') {
      fetchVMFiles();
      checkLocalFiles();
    }
  }, [activeTab]);

  // Cleanup audio on unmount
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // Fetch files from VM
  const fetchVMFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${VM_BASE_URL}/list`);
      const data = await response.json();
      setVmFiles(data.files || []);
    } catch (error) {
      console.error('Error fetching VM files:', error);
      Alert.alert('Error', 'Failed to fetch files from server');
    } finally {
      setLoading(false);
    }
  };

  // Check which files exist locally
  const checkLocalFiles = async () => {
    try {
      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(LOCAL_FOLDER_URI);
      const fileNames = files.map(fileUri => {
        const decodedUri = decodeURIComponent(fileUri);
        return decodedUri.split('/').pop();
      });
      setLocalFiles(fileNames);
    } catch (error) {
      console.error('Error checking local files:', error);
    }
  };

  // Upload file to VM
  const uploadFile = async () => {
    try {
      setUploading(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const file = result.assets[0];
      const fileData = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const uploadData = {
        name: file.name,
        data: fileData,
      };

      const response = await fetch(`${VM_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });

      if (response.ok) {
        Alert.alert('Success', 'File uploaded successfully!');
        if (activeTab === 'media') {
          fetchVMFiles();
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  // Download file from VM to local storage
  const downloadFile = async (filename) => {
    try {
      setDownloading(true);
      setDownloadingFile(filename);

      // Step 1: Download to cache
      const localPath = FileSystem.cacheDirectory + 'temp_' + filename;
      const downloadResumable = FileSystem.createDownloadResumable(
        `${VM_BASE_URL}/?filename=${filename}`,
        localPath
      );
      const result = await downloadResumable.downloadAsync();

      // Step 2: Create file in SAF folder
      const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        LOCAL_FOLDER_URI,
        filename,
        getMimeType(filename)
      );

      // Step 3: Read and write to SAF
      const fileData = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await FileSystem.StorageAccessFramework.writeAsStringAsync(safFileUri, fileData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      Alert.alert('Success', 'File downloaded successfully!');
      checkLocalFiles();
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
    } finally {
      setDownloading(false);
      setDownloadingFile(null);
    }
  };

  // Get MIME type based on file extension
  const getMimeType = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      pdf: 'application/pdf',
      txt: 'text/plain',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  };

  // Check if file is a video
  const isVideoFile = (filename) => {
    const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
    const extension = filename.split('.').pop().toLowerCase();
    return videoExtensions.includes(extension);
  };

  // Check if file is an image
  const isImageFile = (filename) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const extension = filename.split('.').pop().toLowerCase();
    return imageExtensions.includes(extension);
  };

  // Check if file is an audio file
  const isAudioFile = (filename) => {
    const audioExtensions = ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'];
    const extension = filename.split('.').pop().toLowerCase();
    return audioExtensions.includes(extension);
  };

  // Get file type for display
  const getFileType = (filename) => {
    if (isVideoFile(filename)) return 'video';
    if (isImageFile(filename)) return 'image';
    if (isAudioFile(filename)) return 'audio';
    return 'file';
  };

  // Open media file based on type
  const openMediaFile = async (filename) => {
    try {
      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(LOCAL_FOLDER_URI);
      const matchedFile = files.find(fileUri => 
        decodeURIComponent(fileUri).endsWith(`/${filename}`)
      );
      
      if (matchedFile) {
        const fileType = getFileType(filename);
        
        switch (fileType) {
          case 'video':
            setSelectedVideo(matchedFile);
            setVideoModalVisible(true);
            break;
          case 'image':
            setSelectedImage(matchedFile);
            setImageModalVisible(true);
            break;
          case 'audio':
            setSelectedAudio({ uri: matchedFile, name: filename });
            setAudioModalVisible(true);
            break;
          default:
            Alert.alert('Info', 'File type not supported for preview');
        }
      }
    } catch (error) {
      console.error('Error opening media file:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };

  // Play/Pause audio
  const playPauseAudio = async () => {
    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.pauseAsync();
          } else {
            await sound.playAsync();
          }
        }
      } else if (selectedAudio) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: selectedAudio.uri },
          { shouldPlay: true }
        );
        setSound(newSound);
        
        // Set up audio status listener
        newSound.setOnPlaybackStatusUpdate((status) => {
          setAudioStatus(status);
        });
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  // Format duration for display
  const formatDuration = (milliseconds) => {
    if (!milliseconds) return '0:00';
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Close audio modal and cleanup
  const closeAudioModal = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    setSelectedAudio(null);
    setAudioModalVisible(false);
    setAudioStatus({});
  };

  // Render file item
  const renderFileItem = ({ item }) => {
    const isLocal = localFiles.includes(item);
    const fileType = getFileType(item);
    const isDownloadingThis = downloadingFile === item;

    const getFileIcon = () => {
      switch (fileType) {
        case 'video': return '🎬';
        case 'image': return '🖼️';
        case 'audio': return '🎵';
        default: return '📄';
      }
    };

    const getActionButton = () => {
      if (!isLocal) {
        return (
          <TouchableOpacity
            style={[styles.downloadButton, isDownloadingThis && styles.downloadingButton]}
            onPress={() => downloadFile(item)}
            disabled={downloading}
          >
            {isDownloadingThis ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.downloadButtonText}>Download</Text>
            )}
          </TouchableOpacity>
        );
      }

      let buttonText = 'Open';
      let buttonColor = '#4CAF50';
      
      switch (fileType) {
        case 'video':
          buttonText = 'Play';
          buttonColor = '#FF6B6B';
          break;
        case 'image':
          buttonText = 'View';
          buttonColor = '#4ECDC4';
          break;
        case 'audio':
          buttonText = 'Play';
          buttonColor = '#45B7D1';
          break;
        default:
          buttonText = 'Open';
          buttonColor = '#96CEB4';
      }

      return (
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: buttonColor }]}
          onPress={() => openMediaFile(item)}
        >
          <Text style={styles.playButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.fileItem}>
        <View style={styles.fileInfo}>
          <Text style={styles.fileIcon}>{getFileIcon()}</Text>
          <View style={styles.fileDetails}>
            <Text style={styles.fileName}>{item}</Text>
            <Text style={styles.fileType}>{fileType.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.fileActions}>
          {isLocal && <Text style={styles.localIndicator}>Local</Text>}
          {getActionButton()}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'media' && styles.activeTab]}
          onPress={() => setActiveTab('media')}
        >
          <Text style={[styles.tabText, activeTab === 'media' && styles.activeTabText]}>
            Media
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upload' && styles.activeTab]}
          onPress={() => setActiveTab('upload')}
        >
          <Text style={[styles.tabText, activeTab === 'upload' && styles.activeTabText]}>
            Upload
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'upload' && (
          <View style={styles.uploadTab}>
            <Text style={styles.title}>Upload File to Server</Text>
            <Button
              title={uploading ? "Uploading..." : "Select & Upload File"}
              onPress={uploadFile}
              disabled={uploading}
            />
            {uploading && <ActivityIndicator size="large" style={styles.loader} />}
          </View>
        )}

        {activeTab === 'media' && (
          <View style={styles.mediaTab}>
            <View style={styles.header}>
              <Text style={styles.title}>Media Files</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={fetchVMFiles}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
            
            {loading ? (
              <ActivityIndicator size="large" style={styles.loader} />
            ) : (
              <FlatList
                data={vmFiles}
                renderItem={renderFileItem}
                keyExtractor={(item) => item}
                style={styles.fileList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
      </View>

      {/* Video Modal */}
      <Modal
        visible={videoModalVisible}
        animationType="slide"
        onRequestClose={() => setVideoModalVisible(false)}
      >
        <View style={styles.videoModal}>
          <View style={styles.videoHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setVideoModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedVideo && (
            <Video
              source={{ uri: selectedVideo }}
              style={styles.video}
              useNativeControls
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModal}>
          <View style={styles.imageHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setImageModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedImage && (
            <ScrollView
              style={styles.imageScrollView}
              contentContainerStyle={styles.imageContainer}
              maximumZoomScale={3}
              minimumZoomScale={1}
            >
              <Image
                source={{ uri: selectedImage }}
                style={styles.image}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Audio Modal */}
      <Modal
        visible={audioModalVisible}
        animationType="slide"
        onRequestClose={closeAudioModal}
      >
        <View style={styles.audioModal}>
          <View style={styles.audioHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeAudioModal}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          
          {selectedAudio && (
            <View style={styles.audioPlayer}>
              <Text style={styles.audioTitle}>🎵 {selectedAudio.name}</Text>
              
              <View style={styles.audioControls}>
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={playPauseAudio}
                >
                  <Text style={styles.audioButtonText}>
                    {audioStatus.isPlaying ? '⏸️ Pause' : '▶️ Play'}
                  </Text>
                </TouchableOpacity>
              </View>

              {audioStatus.isLoaded && (
                <View style={styles.audioInfo}>
                  <Text style={styles.audioTime}>
                    {formatDuration(audioStatus.positionMillis)} / {formatDuration(audioStatus.durationMillis)}
                  </Text>
                  
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${(audioStatus.positionMillis / audioStatus.durationMillis) * 100 || 0}%` 
                        }
                      ]} 
                    />
                  </View>
                  
                  <Text style={styles.audioStatus}>
                    {audioStatus.isPlaying ? 'Playing...' : 
                     audioStatus.isLoaded ? 'Paused' : 'Loading...'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  uploadTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaTab: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  fileList: {
    flex: 1,
  },
  fileItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  fileType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  localIndicator: {
    color: '#4CAF50',
    fontWeight: '500',
    marginRight: 10,
  },
  playButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  playButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  downloadButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  downloadingButton: {
    backgroundColor: '#ccc',
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  loader: {
    marginTop: 20,
  },
  videoModal: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoHeader: {
    padding: 20,
    paddingTop: 50,
    alignItems: 'flex-end',
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  video: {
    flex: 1,
  },
  imageModal: {
    flex: 1,
    backgroundColor: 'black',
  },
  imageHeader: {
    padding: 20,
    paddingTop: 50,
    alignItems: 'flex-end',
  },
  imageScrollView: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 100,
  },
  audioModal: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  audioHeader: {
    padding: 20,
    paddingTop: 50,
    alignItems: 'flex-end',
  },
  audioPlayer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  audioTitle: {
    fontSize: 20,
    color: 'white',
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '600',
  },
  audioControls: {
    marginBottom: 30,
  },
  audioButton: {
    backgroundColor: '#45B7D1',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  audioButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  audioInfo: {
    width: '100%',
    alignItems: 'center',
  },
  audioTime: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 15,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#45B7D1',
    borderRadius: 2,
  },
  audioStatus: {
    color: '#ccc',
    fontSize: 14,
  },
});