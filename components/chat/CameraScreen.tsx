import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

interface CameraScreenProps {
  roomId: string;
  userId: string;
  // NOTE: Ensure your onSend function DOES NOT use readAsStringAsync
  onSend: (uri: string, mediaType: 'photo' | 'video', duration?: number, caption?: string) => Promise<void>;
  onClose: () => void;
}

type CameraMode = 'photo' | 'video';

export default function CameraScreen({ roomId, userId, onSend, onClose }: CameraScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  
  // Camera State
  const [cameraMode, setCameraMode] = useState<CameraMode>('photo');
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  
  // Media State
  const [capturedMedia, setCapturedMedia] = useState<{ uri: string; type: 'photo' | 'video'; duration?: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const toggleFlash = useCallback(() => {
    setFlash(prev => (prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'));
  }, []);

  const toggleCamera = useCallback(() => {
    setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // --- Capture Logic ---

  const handleShutterPress = useCallback(async () => {
    if (!cameraRef.current) return;

    if (cameraMode === 'photo') {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: false,
          skipProcessing: true,
          shutterSound: false, // <--- THIS DISABLES THE SOUND
        });
        if (photo?.uri) setCapturedMedia({ uri: photo.uri, type: 'photo' });
      } catch (error) {
        Alert.alert('Error', 'Failed to take photo');
      }
    } else {
      // Video Mode
      if (isRecording) {
        stopVideoRecording();
      } else {
        startVideoRecording();
      }
    }
  }, [cameraMode, isRecording]);

  const startVideoRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Memory Optimization: Record at 480p or 720p
      const videoData = await cameraRef.current.recordAsync({
        maxDuration: 60,
        quality: '480p', // 480p is sufficient for chat and prevents OOM
        mute: false,
      });
      
      // Cleanup timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (videoData?.uri) {
        setIsProcessing(true);
        // Small delay to ensure file is finalized
        setTimeout(() => {
            setCapturedMedia({ 
                uri: videoData.uri, 
                type: 'video', 
                duration: recordingDuration 
            });
            setIsProcessing(false);
            setIsRecording(false);
        }, 500);
      } else {
        setIsRecording(false);
      }

    } catch (error: any) {
      console.error('Recording error:', error);
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (!error?.message?.includes('stopped')) {
         Alert.alert('Error', 'Failed to record video');
      }
    }
  };

  const stopVideoRecording = async () => {
    if (!cameraRef.current || !isRecording) return;
    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.log('Error stopping', error);
    }
  };

  const handleRetake = useCallback(() => {
    setCapturedMedia(null);
    setCaption('');
    setRecordingDuration(0);
    setIsRecording(false);
  }, []);

  // --- SEND LOGIC ---
  const handleSend = useCallback(async () => {
    if (!capturedMedia || isSending) return;

    setIsSending(true);
    try {
        const duration = capturedMedia.type === 'video' ? capturedMedia.duration : undefined;
        
        // We pass the URI directly. 
        // DO NOT READ THE FILE HERE OR IN THE PARENT.
        await onSend(capturedMedia.uri, capturedMedia.type, duration, caption);
        
        // Success cleanup
        setCapturedMedia(null);
        setCaption('');
        onClose(); // Optional: Close camera after send
    } catch (error: any) {
      console.error('Send error:', error);
      Alert.alert('Upload Failed', 'Could not send media.');
    } finally {
        setIsSending(false);
    }
  }, [capturedMedia, isSending, caption, onSend, onClose]);

  // --- RENDER ---
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{color:'white', textAlign:'center', marginTop: 100}}>Camera Permission Required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permBtn}><Text>Grant</Text></TouchableOpacity>
      </View>
    );
  }

  if (isProcessing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1DAB61" />
        <Text style={{color:'white', marginTop:10}}>Processing Video...</Text>
      </View>
    );
  }

  // PREVIEW SCREEN
  if (capturedMedia) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewHeader}>
            <TouchableOpacity onPress={handleRetake}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        </View>

        <View style={styles.mediaPreview}>
            {capturedMedia.type === 'photo' ? (
              <Image source={{ uri: capturedMedia.uri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <Video
                source={{ uri: capturedMedia.uri }}
                style={styles.previewImage}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
              />
            )}
        </View>

        <View style={styles.captionArea}>
            <TextInput
              style={styles.input}
              placeholder="Add caption..."
              placeholderTextColor="#999"
              value={caption}
              onChangeText={setCaption}
            />
            <TouchableOpacity onPress={handleSend} disabled={isSending} style={styles.sendBtn}>
                {isSending ? <ActivityIndicator color="#fff"/> : <Ionicons name="send" size={20} color="#fff" />}
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // CAMERA SCREEN
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flash} mode={cameraMode}>
        <SafeAreaView style={styles.uiLayer}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            {isRecording && (
                <View style={styles.timerPill}>
                    <View style={styles.redDot} />
                    <Text style={{color:'white'}}>{formatDuration(recordingDuration)}</Text>
                </View>
            )}

            <View style={styles.bottomControls}>
                {!isRecording && (
                    <View style={styles.modeSwitch}>
                        <TouchableOpacity onPress={()=>setCameraMode('photo')}>
                            <Text style={[styles.modeText, cameraMode==='photo' && styles.activeMode]}>PHOTO</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={()=>setCameraMode('video')}>
                            <Text style={[styles.modeText, cameraMode==='video' && styles.activeMode]}>VIDEO</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.actionRow}>
                    <TouchableOpacity onPress={toggleFlash}>
                        <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={28} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={handleShutterPress} 
                        style={[
                            styles.shutterOuter, 
                            cameraMode === 'video' ? {borderColor: 'red'} : {borderColor: 'white'}
                        ]}
                    >
                        <View style={[
                            styles.shutterInner,
                            cameraMode === 'video' ? {backgroundColor: 'red'} : {backgroundColor: 'white'},
                            isRecording && { width: 30, height: 30, borderRadius: 4 }
                        ]} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={toggleCamera}>
                        <Ionicons name="camera-reverse" size={28} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  camera: { flex: 1 },
  uiLayer: { flex: 1, justifyContent: 'space-between' },
  permBtn: { backgroundColor: 'white', padding: 10, alignSelf: 'center', marginTop: 20 },
  previewHeader: { padding: 16, backgroundColor: 'black' },
  mediaPreview: { flex: 1, justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  captionArea: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 10 },
  input: { flex: 1, backgroundColor: '#333', color: 'white', borderRadius: 20, padding: 10 },
  sendBtn: { backgroundColor: '#1DAB61', padding: 12, borderRadius: 25 },
  closeBtn: { alignSelf: 'flex-end', padding: 16, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, margin: 10 },
  timerPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,0,0,0.5)', padding: 8, borderRadius: 12 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'white', marginRight: 6 },
  bottomControls: { paddingBottom: 40, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', paddingTop: 20 },
  modeSwitch: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  modeText: { color: '#888', fontWeight: 'bold' },
  activeMode: { color: '#FFD700' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', alignItems: 'center' },
  shutterOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30 },
});