// app/chat/video-call.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
} from 'react-native-webrtc';
import { useSocket } from '@/contexts/SocketContext';
import { useVideoCall } from '@/contexts/VideoCallContext';
import socketManager from '@/utils/socketManager';

const { width, height } = Dimensions.get('window');

interface Participant {
  oderId: string;
  userName: string;
  streamURL: string | null; // Store URL instead of stream object
  stream: MediaStream | null;
  peerConnection: RTCPeerConnection;
  iceCandidatesQueue: any[];
  isRemoteDescriptionSet: boolean;
}

// WebRTC configuration with more STUN/TURN servers
const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export default function VideoCallScreen() {
  const { roomId, roomName, joining } = useLocalSearchParams();
  const { isConnected, user } = useSocket();
  const { setActiveCall, clearIncomingCall } = useVideoCall();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localStreamURL, setLocalStreamURL] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callState, setCallState] = useState<'connecting' | 'calling' | 'connected'>('connecting');
  const [debugInfo, setDebugInfo] = useState<string>('');

  const localStreamRef = useRef<MediaStream | null>(null);
  const participantsRef = useRef<Map<string, Participant>>(new Map());
  const isCleaningUpRef = useRef(false);
  const subscriptionIdsRef = useRef<number[]>([]);
  const pendingStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId;
  const roomNameStr = Array.isArray(roomName) ? roomName[0] : roomName || 'Video Call';
  const isJoining = joining === 'true';

  // Force re-render of participants
  const forceUpdateParticipants = useCallback(() => {
    setParticipants(new Map(participantsRef.current));
  }, []);

  // Update debug info
  const updateDebug = useCallback((message: string) => {
    console.log('📹 DEBUG:', message);
    setDebugInfo(prev => `${message}\n${prev}`.slice(0, 500));
  }, []);

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
  const initializeLocalStream = async (): Promise<boolean> => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        return false;
      }

      updateDebug('Initializing local stream...');
      
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { min: 15, ideal: 24, max: 30 },
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setLocalStreamURL(stream.toURL());
      
      updateDebug(`Local stream ready: ${stream.getTracks().map(t => t.kind).join(', ')}`);
      return true;
    } catch (error: any) {
      console.error('Error getting user media:', error);
      updateDebug(`Error: ${error.message}`);
      Alert.alert('Error', 'Failed to access camera and microphone. Please check permissions.');
      return false;
    }
  };

  // Create peer connection for a participant
  const createPeerConnection = useCallback((targetUserId: string, targetUserName: string): RTCPeerConnection => {
    updateDebug(`Creating peer connection for: ${targetUserId}`);
    
    const peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);

    // Create participant entry first
    const participant: Participant = {
      oderId: targetUserId,
      userName: targetUserName,
      streamURL: null,
      stream: null,
      peerConnection,
      iceCandidatesQueue: [],
      isRemoteDescriptionSet: false,
    };
    participantsRef.current.set(targetUserId, participant);
    forceUpdateParticipants();

    // Add local stream tracks BEFORE any negotiation
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      updateDebug(`Adding ${tracks.length} local tracks to peer connection`);
      tracks.forEach((track) => {
        try {
          peerConnection.addTrack(track, localStreamRef.current!);
          updateDebug(`Added local ${track.kind} track`);
        } catch (e: any) {
          updateDebug(`Error adding track: ${e.message}`);
        }
      });
    } else {
      updateDebug('WARNING: No local stream when creating peer connection!');
    }

    // Handle remote stream - THIS IS THE KEY FIX
    // (peerConnection as any).ontrack = (event: any) => {
    //   updateDebug(`ontrack event from ${targetUserId}: ${event.track?.kind}`);
      
    //   let remoteStream: MediaStream | null = null;
      
    //   // Try to get stream from event
    //   if (event.streams && event.streams.length > 0) {
    //     remoteStream = event.streams[0];
    //     updateDebug(`Got stream from event.streams: ${remoteStream?.id}`);
    //   } else if (event.track) {
    //     // Create new MediaStream with the track
    //     remoteStream = new MediaStream([event.track]);
    //     updateDebug(`Created new stream with track: ${event.track.kind}`);
    //   }
      
    //   if (remoteStream) {
    //     const streamURL = remoteStream.toURL();
    //     updateDebug(`Remote stream URL: ${streamURL.substring(0, 50)}...`);
        
    //     // Update participant
    //     const existingParticipant = participantsRef.current.get(targetUserId);
    //     if (existingParticipant) {
    //       // If we already have a stream, add the new track to it
    //       if (existingParticipant.stream && event.track) {
    //         const existingTracks = existingParticipant.stream.getTracks();
    //         const hasTrackType = existingTracks.some(t => t.kind === event.track.kind);
    //         if (!hasTrackType) {
    //           existingParticipant.stream.addTrack(event.track);
    //           updateDebug(`Added ${event.track.kind} track to existing stream`);
    //         }
    //       } else {
    //         existingParticipant.stream = remoteStream;
    //         existingParticipant.streamURL = streamURL;
    //       }
    //       participantsRef.current.set(targetUserId, existingParticipant);
    //     } else {
    //       // Store for later if participant doesn't exist yet
    //       pendingStreamsRef.current.set(targetUserId, remoteStream);
    //       updateDebug(`Stored pending stream for ${targetUserId}`);
    //     }
        
    //     // Force UI update
    //     forceUpdateParticipants();
    //     setCallState('connected');
    //   }
    // };

    (peerConnection as any).ontrack = (event: any) => {
      
      updateDebug(`ontrack from ${targetUserId}: ${event.track.kind}`);
    
      let participant = participantsRef.current.get(targetUserId);
      if (!participant) return;
    
      if (!participant.stream) {
        participant.stream = new MediaStream();
      }
    
      participant.stream.addTrack(event.track);
      participant.streamURL = participant.stream.toURL();
    
      participantsRef.current.set(targetUserId, participant);
      forceUpdateParticipants();
      setCallState('connected');

      updateDebug(
        `Tracks now: ${participant.stream?.getTracks().map(t => t.kind).join(',')}`
      );
      
    };
    
    // Handle ICE candidates
    (peerConnection as any).onicecandidate = (event: any) => {
      if (event.candidate && roomIdStr && user?.id) {
        updateDebug(`Sending ICE candidate to ${targetUserId}`);
        socketManager.sendVideoCallIceCandidateToUser(
          roomIdStr,
          targetUserId,
          event.candidate.toJSON()
        );
      }
    };

    // Handle ICE gathering state
    (peerConnection as any).onicegatheringstatechange = () => {
      const state = (peerConnection as any).iceGatheringState;
      updateDebug(`ICE gathering state: ${state}`);
    };

    // Handle connection state
    (peerConnection as any).onconnectionstatechange = () => {
      const state = (peerConnection as any).connectionState;
      updateDebug(`Connection state with ${targetUserId}: ${state}`);
      
      if (state === 'connected') {
        setCallState('connected');
      } else if (state === 'failed') {
        updateDebug(`Connection failed, attempting ICE restart...`);
        try {
          (peerConnection as any).restartIce?.();
        } catch (e: any) {
          updateDebug(`ICE restart failed: ${e.message}`);
        }
      }
    };

    // Handle ICE connection state
    (peerConnection as any).oniceconnectionstatechange = () => {
      const state = (peerConnection as any).iceConnectionState;
      updateDebug(`ICE connection state with ${targetUserId}: ${state}`);
    };

    // Handle signaling state
    (peerConnection as any).onsignalingstatechange = () => {
      const state = (peerConnection as any).signalingState;
      updateDebug(`Signaling state with ${targetUserId}: ${state}`);
    };

    // Handle negotiation needed
    (peerConnection as any).onnegotiationneeded = () => {
      updateDebug(`Negotiation needed with ${targetUserId}`);
    };

    // Check for any pending streams
    const pendingStream = pendingStreamsRef.current.get(targetUserId);
    if (pendingStream) {
      participant.stream = pendingStream;
      participant.streamURL = pendingStream.toURL();
      pendingStreamsRef.current.delete(targetUserId);
      participantsRef.current.set(targetUserId, participant);
      forceUpdateParticipants();
      updateDebug(`Applied pending stream for ${targetUserId}`);
    }

    return peerConnection;
  }, [roomIdStr, user?.id, updateDebug, forceUpdateParticipants]);

  // Process queued ICE candidates
  const processIceCandidateQueue = useCallback(async (participant: Participant) => {
    if (!participant.isRemoteDescriptionSet) return;
    
    updateDebug(`Processing ${participant.iceCandidatesQueue.length} queued ICE candidates`);
    
    while (participant.iceCandidatesQueue.length > 0) {
      const candidate = participant.iceCandidatesQueue.shift();
      try {
        await participant.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        updateDebug(`Added queued ICE candidate`);
      } catch (e: any) {
        updateDebug(`Error adding queued ICE candidate: ${e.message}`);
      }
    }
  }, [updateDebug]);

  // Create and send offer to a specific user
  const createAndSendOffer = useCallback(async (targetUserId: string, targetUserName: string) => {
    if (!roomIdStr || !localStreamRef.current || !user) {
      updateDebug('Cannot create offer: missing requirements');
      return;
    }

    // Don't create duplicate peer connections
    if (participantsRef.current.has(targetUserId)) {
      updateDebug(`Already have peer connection for: ${targetUserId}`);
      return;
    }

    try {
      updateDebug(`Creating offer for: ${targetUserId}`);
      const peerConnection = createPeerConnection(targetUserId, targetUserName);
      
      // Small delay to ensure tracks are added
      await new Promise(resolve => setTimeout(resolve, 100));
      peerConnection.addTransceiver('video', { direction: 'sendrecv' });
      peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

      
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      updateDebug(`Offer created, setting local description...`);
      await peerConnection.setLocalDescription(offer);
      
      updateDebug(`Sending offer to: ${targetUserId}`);
      socketManager.sendVideoCallOfferToUser(roomIdStr, targetUserId, {
        type: offer.type,
        sdp: offer.sdp,
      });
    } catch (error: any) {
      updateDebug(`Error creating offer: ${error.message}`);
      console.error('Error creating offer:', error);
    }
  }, [roomIdStr, user, createPeerConnection, updateDebug]);

  // Handle received offer
  const handleOffer = useCallback(async (data: any) => {
    if (!data.offer || !data.callerId || data.callerId === user?.id) {
      return;
    }

    updateDebug(`Received offer from: ${data.callerId}`);

    try {
      // Get or create peer connection
      let participant = participantsRef.current.get(data.callerId);
      let peerConnection: RTCPeerConnection;

      if (participant) {
        peerConnection = participant.peerConnection;
        updateDebug(`Using existing peer connection for ${data.callerId}`);
      } else {
        peerConnection = createPeerConnection(data.callerId, data.callerName || 'Unknown');
        participant = participantsRef.current.get(data.callerId)!;
        updateDebug(`Created new peer connection for ${data.callerId}`);
      }

      // Set remote description
      updateDebug(`Setting remote description from ${data.callerId}...`);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      participant.isRemoteDescriptionSet = true;
      participantsRef.current.set(data.callerId, participant);
      
      // Process any queued ICE candidates
      await processIceCandidateQueue(participant);
      
      // Create and send answer
      updateDebug(`Creating answer for ${data.callerId}...`);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      updateDebug(`Sending answer to: ${data.callerId}`);
      socketManager.sendVideoCallAnswerToUser(roomIdStr!, data.callerId, {
        type: answer.type,
        sdp: answer.sdp,
      });
      
      forceUpdateParticipants();
    } catch (error: any) {
      updateDebug(`Error handling offer: ${error.message}`);
      console.error('Error handling offer:', error);
    }
  }, [user?.id, roomIdStr, createPeerConnection, processIceCandidateQueue, updateDebug, forceUpdateParticipants]);

  // Handle received answer
  const handleAnswer = useCallback(async (data: any) => {
    if (!data.answer || !data.answererId || data.answererId === user?.id) {
      return;
    }

    updateDebug(`Received answer from: ${data.answererId}`);
    const participant = participantsRef.current.get(data.answererId);

    if (participant) {
      try {
        updateDebug(`Setting remote description from answer...`);
        await participant.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        participant.isRemoteDescriptionSet = true;
        participantsRef.current.set(data.answererId, participant);
        
        // Process any queued ICE candidates
        await processIceCandidateQueue(participant);
        
        forceUpdateParticipants();
        updateDebug(`Answer processed successfully`);
      } catch (error: any) {
        updateDebug(`Error handling answer: ${error.message}`);
        console.error('Error handling answer:', error);
      }
    } else {
      updateDebug(`No participant found for answer from: ${data.answererId}`);
    }
  }, [user?.id, processIceCandidateQueue, updateDebug, forceUpdateParticipants]);

  // Handle received ICE candidate
  const handleIceCandidate = useCallback(async (data: any) => {
    if (!data.candidate || !data.senderId || data.senderId === user?.id) {
      return;
    }

    const participant = participantsRef.current.get(data.senderId);
    if (participant) {
      try {
        if (participant.isRemoteDescriptionSet) {
          await participant.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          updateDebug(`Added ICE candidate from ${data.senderId}`);
        } else {
          // Queue the candidate
          participant.iceCandidatesQueue.push(data.candidate);
          updateDebug(`Queued ICE candidate from ${data.senderId}`);
        }
      } catch (error: any) {
        updateDebug(`Error adding ICE candidate: ${error.message}`);
      }
    } else {
      updateDebug(`No participant found for ICE candidate from: ${data.senderId}`);
    }
  }, [user?.id, updateDebug]);

  // Handle new user joined the call
  const handleUserJoined = useCallback(async (data: any) => {
    if (!data.userId || data.userId === user?.id) {
      return;
    }

    updateDebug(`New user joined call: ${data.userId} (${data.userName})`);
    
    // Wait a bit for the joiner to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create peer connection and send offer to the new joiner
    await createAndSendOffer(data.userId, data.userName || 'Unknown');
  }, [user?.id, createAndSendOffer, updateDebug]);

  // Handle user left the call
  const handleUserLeft = useCallback((data: any) => {
    if (!data.userId || data.userId === user?.id) {
      return;
    }

    updateDebug(`User left call: ${data.userId}`);
    
    const participant = participantsRef.current.get(data.userId);
    if (participant) {
      try {
        participant.peerConnection.close();
      } catch (e) {
        // Ignore
      }
      participantsRef.current.delete(data.userId);
      pendingStreamsRef.current.delete(data.userId);
      forceUpdateParticipants();
    }
  }, [user?.id, updateDebug, forceUpdateParticipants]);

  // Handle existing participants list
  const handleParticipantsList = useCallback(async (data: any) => {
    if (!data.participants || !Array.isArray(data.participants)) {
      return;
    }

    updateDebug(`Received existing participants: ${data.participants.join(', ')}`);
    
    // Create peer connections and send offers to all existing participants
    for (const participantId of data.participants) {
      if (participantId !== user?.id && !participantsRef.current.has(participantId)) {
        // Stagger the offers slightly to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 200));
        await createAndSendOffer(participantId, 'Participant');
      }
    }
  }, [user?.id, createAndSendOffer, updateDebug]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      updateDebug(`Microphone ${isMuted ? 'unmuted' : 'muted'}`);
    }
  }, [isMuted, updateDebug]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
      updateDebug(`Video ${isVideoEnabled ? 'disabled' : 'enabled'}`);
    }
  }, [isVideoEnabled, updateDebug]);

  // Switch camera
  const switchCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track: any) => {
        if (track._switchCamera) {
          track._switchCamera();
          updateDebug('Camera switched');
        }
      });
    }
  }, [updateDebug]);

  // End call and cleanup
  const handleEndCall = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    updateDebug('Ending call...');

    // Notify server
    if (roomIdStr) {
      socketManager.endVideoCall(roomIdStr);
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Close all peer connections
    participantsRef.current.forEach((participant) => {
      try {
        participant.peerConnection.close();
      } catch (e) {
        // Ignore
      }
    });
    participantsRef.current.clear();
    pendingStreamsRef.current.clear();

    // Clear subscriptions
    subscriptionIdsRef.current.forEach((id) => socketManager.off(id));
    subscriptionIdsRef.current = [];

    // Clear state
    setLocalStream(null);
    setLocalStreamURL(null);
    setParticipants(new Map());
    setActiveCall(null);

    // Navigate back
    router.back();
  }, [roomIdStr, setActiveCall, updateDebug]);

  // Initialize call
  useEffect(() => {
    if (!isConnected || !roomIdStr || !user) {
      Alert.alert('Error', 'Not connected to server or room ID missing');
      router.back();
      return;
    }

    updateDebug(`Initializing video call, joining: ${isJoining}`);
    
    // Clear any incoming call notification
    clearIncomingCall();

    const init = async () => {
      const streamInit = await initializeLocalStream();
      if (!streamInit) {
        router.back();
        return;
      }

      // Set active call
      setActiveCall({
        roomId: roomIdStr,
        roomName: roomNameStr,
        isInitiator: !isJoining,
        participants: [],
      });

      // Small delay to ensure stream is ready
      await new Promise(resolve => setTimeout(resolve, 300));

      if (isJoining) {
        // User is joining - notify existing participants
        updateDebug('Joining existing call, notifying participants...');
        setCallState('connecting');
        socketManager.notifyVideoCallJoined(roomIdStr);
      } else {
        // User is starting the call
        updateDebug('Starting new call, notifying room members...');
        setCallState('calling');
        socketManager.initiateVideoCall(roomIdStr, roomNameStr);
      }
    };

    init();

    // Set up socket listeners
    const offerSub = socketManager.on('video-call-offer', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleOffer(data);
      }
    });
    subscriptionIdsRef.current.push(offerSub);

    const answerSub = socketManager.on('video-call-answer', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleAnswer(data);
      }
    });
    subscriptionIdsRef.current.push(answerSub);

    const iceSub = socketManager.on('video-call-ice-candidate', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleIceCandidate(data);
      }
    });
    subscriptionIdsRef.current.push(iceSub);

    const userJoinedSub = socketManager.on('video-call-user-joined', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleUserJoined(data);
      }
    });
    subscriptionIdsRef.current.push(userJoinedSub);

    const userLeftSub = socketManager.on('video-call-user-left', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleUserLeft(data);
      }
    });
    subscriptionIdsRef.current.push(userLeftSub);

    const participantsSub = socketManager.on('video-call-participants', (data: any) => {
      if (data.roomId === roomIdStr) {
        handleParticipantsList(data);
      }
    });
    subscriptionIdsRef.current.push(participantsSub);

    const endCallSub = socketManager.on('video-call-end', (data: any) => {
      if (data.roomId === roomIdStr && data.userId !== user?.id) {
        handleUserLeft(data);
        
        // If we're the only one left, show message
        if (participantsRef.current.size === 0 && callState === 'connected') {
          Alert.alert('Call Ended', 'All participants have left the call.', [
            { text: 'OK', onPress: handleEndCall }
          ]);
        }
      }
    });
    subscriptionIdsRef.current.push(endCallSub);

    // Handle back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEndCall();
      return true;
    });

    return () => {
      backHandler.remove();
      if (!isCleaningUpRef.current) {
        handleEndCall();
      }
    };
  }, []);

  const participantArray = Array.from(participants.values());

  const getCallStateText = () => {
    switch (callState) {
      case 'connecting':
        return 'Connecting...';
      case 'calling':
        return 'Calling...';
      case 'connected':
        return `${participantArray.length + 1} participants`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Room info header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.roomName}>{roomNameStr}</Text>
          <Text style={styles.callStatus}>{getCallStateText()}</Text>
        </View>
      </View>

      {/* Videos container */}
      <View style={styles.videosWrapper}>
        {participantArray.length === 0 ? (
          // No participants yet - show local video large
          <View style={styles.singleVideoContainer}>
            {localStreamURL ? (
              <RTCView
                streamURL={localStreamURL}
                style={styles.fullVideo}
                objectFit="cover"
                mirror={true}
                zOrder={0}
              />
            ) : null}
            <View style={styles.waitingOverlay}>
              <Ionicons name="call-outline" size={60} color="#fff" />
              <Text style={styles.waitingText}>
                {callState === 'calling' ? 'Waiting for others to join...' : 'Connecting...'}
              </Text>
            </View>
          </View>
        ) : (
          // Multiple participants - grid layout
          <ScrollView 
            contentContainerStyle={styles.gridContainer}
            style={styles.gridScrollView}
          >
            {/* Remote participants */}
            {participantArray.map((participant) => (
              <View 
                key={participant.oderId} 
                style={[
                  styles.gridItem,
                  participantArray.length === 1 && styles.gridItemFull,
                ]}
              >
                {participant.streamURL ? (
                  <RTCView
                    streamURL={participant.streamURL}
                    style={styles.gridVideo}
                    objectFit="cover"
                    mirror={false}
                    zOrder={0}
                  />
                ) : (
                  <View style={styles.noVideoPlaceholder}>
                    <Ionicons name="person" size={50} color="#666" />
                    <Text style={styles.connectingText}>Connecting...</Text>
                    <Text style={styles.participantIdText}>{participant.oderId}</Text>
                  </View>
                )}
                <View style={styles.participantLabel}>
                  <Text style={styles.participantName}>{participant.userName}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Local video (picture-in-picture) - only when there are other participants */}
        {participantArray.length > 0 && localStreamURL && (
          <TouchableOpacity 
            style={styles.localVideoContainer}
            activeOpacity={0.9}
          >
            <RTCView
              streamURL={localStreamURL}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
              zOrder={1}
            />
            <View style={styles.localVideoLabel}>
              <Text style={styles.localVideoLabelText}>You</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Debug info - remove in production */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText} numberOfLines={5}>
            {debugInfo}
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
          onPress={toggleVideo}
        >
          <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
          <Ionicons name="camera-reverse" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerInfo: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  roomName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  callStatus: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  videosWrapper: {
    flex: 1,
  },
  singleVideoContainer: {
    flex: 1,
    position: 'relative',
  },
  fullVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  waitingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
  },
  gridScrollView: {
    flex: 1,
  },
  gridContainer: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
    paddingTop: 100,
    paddingBottom: 150,
  },
  gridItem: {
    width: '50%',
    aspectRatio: 3 / 4,
    padding: 4,
  },
  gridItemFull: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  gridVideo: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  noVideoPlaceholder: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  participantIdText: {
    color: '#555',
    fontSize: 10,
    marginTop: 4,
  },
  participantLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  participantName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 100,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#000',
    zIndex: 20,
    elevation: 10,
  },
  localVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  localVideoLabel: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  localVideoLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  debugContainer: {
    position: 'absolute',
    bottom: 120,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    zIndex: 100,
  },
  debugText: {
    color: '#0f0',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    gap: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
});