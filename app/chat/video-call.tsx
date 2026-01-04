// app/chat/video-call.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  PermissionsAndroid,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import { useSocket } from '@/contexts/SocketContext';
import socketManager from '@/utils/socketManager';

const { width, height } = Dimensions.get('window');

interface Participant {
  userId: string;
  userName: string;
  stream: any;
  peerConnection: RTCPeerConnection;
}

export default function VideoCallScreen() {
  const { roomId, joining } = useLocalSearchParams();
  const { isConnected, user } = useSocket();

  const [localStream, setLocalStream] = useState<any>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [calling, setCalling] = useState(true);
  const [connected, setConnected] = useState(false);
  const [isInitiator, setIsInitiator] = useState(true);

  const localStreamRef = useRef<any>(null);
  const participantsRef = useRef<Map<string, Participant>>(new Map());
  const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId;

  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Request permissions
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        if (
          grants['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          return true;
        } else {
          Alert.alert('Permissions Required', 'Camera and microphone permissions are required for video calls.');
          return false;
        }
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  // Initialize local media stream
  const initializeLocalStream = async () => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        router.back();
        return;
      }

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      return true;
    } catch (error) {
      console.error('Error getting user media:', error);
      Alert.alert('Error', 'Failed to access camera and microphone. Please check permissions.');
      router.back();
      return false;
    }
  };

  // Create peer connection for a participant
  const createPeerConnection = (userId: string, userName: string, isInitiating: boolean): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    (peerConnection as any).ontrack = (event: any) => {
      console.log('📹 Received remote stream from:', userId);
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        const participant = participantsRef.current.get(userId);
        if (participant) {
          participant.stream = stream;
          // Force update by creating new Map
          const updatedMap = new Map(participantsRef.current);
          setParticipants(updatedMap);
          console.log('📹 Stream stored for participant:', userId);
        } else {
          console.warn('📹 Received stream but participant not found:', userId);
          // Store stream even if participant entry doesn't exist yet
          const newParticipant: Participant = {
            userId,
            userName,
            stream,
            peerConnection,
          };
          participantsRef.current.set(userId, newParticipant);
          setParticipants(new Map(participantsRef.current));
        }
      }
    };

    // Handle ICE candidates
    (peerConnection as any).onicecandidate = (event: any) => {
      if (event.candidate && roomIdStr) {
        socketManager.sendVideoCallIceCandidate(roomIdStr, event.candidate.toJSON());
      }
    };

    // Handle connection state
    (peerConnection as any).onconnectionstatechange = () => {
      const state = (peerConnection as any).connectionState;
      console.log(`Connection state with ${userId}:`, state);
      
      if (state === 'connected') {
        setConnected(true);
        setCalling(false);
      } else if (state === 'disconnected') {
        // Don't remove on disconnected - allow reconnection
        console.log(`Connection disconnected with ${userId}, waiting for reconnection...`);
      } else if (state === 'failed') {
        // Don't remove on failed - connection might recover
        console.log(`Connection failed with ${userId}, but keeping participant...`);
        // Optionally try to restart ICE
        try {
          (peerConnection as any).restartIce();
        } catch (e) {
          console.log('Could not restart ICE:', e);
        }
      } else if (state === 'closed') {
        // Only remove on explicit close (not from our end call handler)
        console.log(`Connection closed with ${userId}`);
        // Don't remove here - let explicit end call handler do it
      }
    };

    // Store participant
    const participant: Participant = {
      userId,
      userName,
      stream: null,
      peerConnection,
    };
    participantsRef.current.set(userId, participant);
    setParticipants(new Map(participantsRef.current));

    return peerConnection;
  };

  // Remove participant
  const removeParticipant = (userId: string) => {
    const participant = participantsRef.current.get(userId);
    if (participant) {
      participant.peerConnection.close();
      participantsRef.current.delete(userId);
      setParticipants(new Map(participantsRef.current));
    }
  };

  // Handle new participant joining (create answer)
  const handleParticipantJoin = async (userId: string, userName: string, offer: any) => {
    console.log('📹 Participant joining:', userId);
    const peerConnection = createPeerConnection(userId, userName, false);

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (roomIdStr) {
        socketManager.sendVideoCallAnswer(roomIdStr, answer);
      }
    } catch (error) {
      console.error('Error handling participant join:', error);
    }
  };

  // Start call - for initiator (just initiate, wait for joiners to send offers)
  const startCall = async () => {
    if (!roomIdStr) return;

    try {
      console.log('📹 Starting call as initiator...');
      setIsInitiator(true);
      socketManager.initiateVideoCall(roomIdStr);
      // Initiator waits for joiners to send offers
    } catch (error) {
      console.error('Error starting call:', error);
      Alert.alert('Error', 'Failed to start video call.');
    }
  };

  // Create and send offer to a specific participant
  const createAndSendOffer = async (targetUserId: string, targetUserName: string) => {
    if (!roomIdStr || !localStreamRef.current || !user) return;

    // Don't create duplicate peer connections
    if (participantsRef.current.has(targetUserId)) {
      console.log('📹 Already have peer connection for:', targetUserId);
      return;
    }

    try {
      console.log('📹 Creating offer for:', targetUserId);
      const peerConnection = createPeerConnection(targetUserId, targetUserName, true);
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socketManager.sendVideoCallOffer(roomIdStr, offer);
      console.log('📹 Offer sent to:', targetUserId);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // Join call - notify existing participants that we joined
  const joinCall = async () => {
    if (!roomIdStr || !localStreamRef.current || !user) return;

    try {
      console.log('📹 Joining call, notifying existing participants...');
      setIsInitiator(false);
      
      // Notify existing participants that we joined
      // They will create peer connections and send offers to us
      socketManager.notifyVideoCallJoined(roomIdStr);
    } catch (error) {
      console.error('Error joining call:', error);
    }
  };

  // Handle received offer - create peer connection and answer
  const handleOffer = async (data: any) => {
    if (!data.offer || !data.callerId || data.callerId === user?.id) return;

    console.log('📹 Received offer from:', data.callerId);
    setIsInitiator(false);

    // Create peer connection for the caller
    const peerConnection = createPeerConnection(data.callerId, data.callerName || 'Unknown', false);

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (roomIdStr) {
        socketManager.sendVideoCallAnswer(roomIdStr, answer);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  // Handle received answer
  const handleAnswer = async (data: any) => {
    if (!data.answer || !data.answererId || data.answererId === user?.id) return;

    console.log('📹 Received answer from:', data.answererId);
    const participant = participantsRef.current.get(data.answererId);

    if (participant) {
      try {
        await participant.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  };

  // Handle received ICE candidate
  const handleIceCandidate = async (data: any) => {
    if (!data.candidate || !data.senderId || data.senderId === user?.id) return;

    const participant = participantsRef.current.get(data.senderId);
    if (participant) {
      try {
        await participant.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track: any) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track: any) => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Switch camera
  const switchCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track: any) => {
        if (track.readyState === 'live' && track._switchCamera) {
          track._switchCamera();
        }
      });
    }
  };

  // End call
  const handleEndCall = () => {
    // Notify other peers
    if (roomIdStr) {
      socketManager.endVideoCall(roomIdStr);
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Close all peer connections
    participantsRef.current.forEach((participant) => {
      participant.peerConnection.close();
    });
    participantsRef.current.clear();
    setParticipants(new Map());

    setLocalStream(null);
    router.back();
  };

  // Initialize on mount
  useEffect(() => {
    if (!isConnected || !roomIdStr) {
      Alert.alert('Error', 'Not connected to server or room ID missing');
      router.back();
      return;
    }

    const init = async () => {
      const streamInit = await initializeLocalStream();
      if (!streamInit) return;

      // Check if user is joining an existing call or starting a new one
      const isJoining = joining === 'true';
      
      if (isJoining) {
        // User is joining - wait for offers from existing participants
        console.log('📹 Joining existing call...');
        await joinCall();
      } else {
        // User is starting the call
        await startCall();
      }
    };

    init();

    // Set up socket listeners
    const offerSub = socketManager.on('video-call-offer', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleOffer(data);
      }
    });

    const answerSub = socketManager.on('video-call-answer', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleAnswer(data);
      }
    });

    const iceSub = socketManager.on('video-call-ice-candidate', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleIceCandidate(data);
      }
    });

    const endCallSub = socketManager.on('video-call-end', (data: any) => {
      if (data.roomId === roomIdStr && data.userId !== user?.id) {
        if (data.userId) {
          removeParticipant(data.userId);
        } else {
          // All users ending
          handleEndCall();
        }
      }
    });

    // Handle user joined event - existing participants create peer connections and send offers
    const userJoinedSub = socketManager.on('video-call-user-joined', (data: any) => {
      if (data.roomId === roomIdStr && data.userId !== user?.id) {
        console.log('📹 New user joined call:', data.userId);
        // Create peer connection and send offer to the new joiner
        createAndSendOffer(data.userId, data.userName || 'Unknown');
      }
    });

    // Cleanup on unmount
    return () => {
      socketManager.off(offerSub);
      socketManager.off(answerSub);
      socketManager.off(iceSub);
      socketManager.off(endCallSub);
      socketManager.off(userJoinedSub);
      handleEndCall();
    };
  }, []);

  const participantArray = Array.from(participants.values());

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Remote videos */}
      <ScrollView 
        contentContainerStyle={styles.videosContainer}
        style={styles.videosScrollView}
      >
        {participantArray.length === 0 ? (
          <View style={styles.placeholderContainer}>
            <Ionicons name="person" size={80} color="#666" />
            <Text style={styles.placeholderText}>
              {calling ? 'Calling...' : 'Waiting for participants...'}
            </Text>
          </View>
        ) : (
          participantArray.map((participant) => (
            <View key={participant.userId} style={styles.remoteVideoContainer}>
              {participant.stream ? (
                <RTCView
                  streamURL={participant.stream.toURL()}
                  style={styles.remoteVideo}
                  objectFit="cover"
                  mirror={false}
                />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Ionicons name="person" size={60} color="#666" />
                  <Text style={styles.placeholderText}>Connecting...</Text>
                </View>
              )}
              <View style={styles.participantLabel}>
                <Text style={styles.participantName}>{participant.userName}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Local video (picture-in-picture) */}
      {localStream && (
        <View style={styles.localVideoContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
          <View style={styles.localVideoLabel}>
            <Text style={styles.localVideoLabelText}>You</Text>
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
          onPress={toggleVideo}
        >
          <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Room info */}
      <View style={styles.roomInfo}>
        <Text style={styles.roomInfoText}>Room: {roomIdStr}</Text>
        <Text style={styles.roomInfoText}>
          {connected ? `${participantArray.length + 1} participants` : calling ? 'Calling...' : 'Connecting...'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videosScrollView: {
    flex: 1,
  },
  videosContainer: {
    flexGrow: 1,
    padding: 8,
    gap: 8,
  },
  remoteVideoContainer: {
    flex: 1,
    minHeight: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  participantLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  participantName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: height * 0.5,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#000',
    zIndex: 10,
  },
  localVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  localVideoLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  localVideoLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    gap: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  endCallButton: {
    backgroundColor: '#f44336',
  },
  roomInfo: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  roomInfoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
