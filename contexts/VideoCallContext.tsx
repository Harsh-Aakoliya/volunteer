// contexts/VideoCallContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    useEffect,
    ReactNode,
  } from 'react';
  import { router } from 'expo-router';
  import socketManager from '@/utils/socketManager';
  import { useSocket } from './SocketContext';
  
  // ==================== TYPES ====================
  
  export interface IncomingCall {
    roomId: string;
    roomName: string;
    callerId: string;
    callerName: string;
    timestamp: number;
  }
  
  export interface ActiveCall {
    roomId: string;
    roomName: string;
    isInitiator: boolean;
    participants: string[];
  }
  
  interface VideoCallContextValue {
    // Incoming call state
    incomingCall: IncomingCall | null;
    
    // Active call state
    activeCall: ActiveCall | null;
    
    // Actions
    acceptCall: () => void;
    rejectCall: () => void;
    initiateCall: (roomId: string, roomName: string) => void;
    endCall: () => void;
    setActiveCall: (call: ActiveCall | null) => void;
    
    // For video call screen
    clearIncomingCall: () => void;
  }
  
  // ==================== CONTEXT ====================
  
  const VideoCallContext = createContext<VideoCallContextValue | null>(null);
  
  // ==================== PROVIDER ====================
  
  interface VideoCallProviderProps {
    children: ReactNode;
  }
  
  export function VideoCallProvider({ children }: VideoCallProviderProps) {
    const { isConnected, user } = useSocket();
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    
    const subscriptionIds = useRef<number[]>([]);
    const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
    // Set up global video call listeners
    useEffect(() => {
      if (!isConnected) return;
  
      console.log('📹 [VideoCallContext] Setting up global video call listeners');
  
      // Clear existing subscriptions
      subscriptionIds.current.forEach((id) => socketManager.off(id));
      subscriptionIds.current = [];
  
      // Listen for incoming video calls globally
      const initiateSubId = socketManager.on('video-call-initiate', (data: any) => {
        console.log('📹 [VideoCallContext] Received video call initiate:', data);
        
        // Don't show notification if:
        // 1. We initiated the call
        // 2. We're already in a call
        // 3. We already have this incoming call
        if (data.callerId === user?.id) {
          console.log('📹 [VideoCallContext] Ignoring - we initiated this call');
          return;
        }
        
        if (activeCall && activeCall.roomId === data.roomId) {
          console.log('📹 [VideoCallContext] Ignoring - already in this call');
          return;
        }
  
        // Set incoming call
        setIncomingCall({
          roomId: data.roomId,
          roomName: data.roomName || 'Video Call',
          callerId: data.callerId,
          callerName: data.callerName || 'Unknown',
          timestamp: Date.now(),
        });
  
        // Auto-dismiss after 60 seconds
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
        }
        callTimeoutRef.current = setTimeout(() => {
          setIncomingCall(null);
        }, 60000);
      });
      subscriptionIds.current.push(initiateSubId);
  
      // Listen for call end
      const endCallSubId = socketManager.on('video-call-end', (data: any) => {
        console.log('📹 [VideoCallContext] Call ended:', data);
        
        // Clear incoming call if it matches
        if (incomingCall && incomingCall.roomId === data.roomId) {
          setIncomingCall(null);
        }
      });
      subscriptionIds.current.push(endCallSubId);
  
      // Listen for call rejection
      const rejectSubId = socketManager.on('video-call-reject', (data: any) => {
        console.log('📹 [VideoCallContext] Call rejected:', data);
        
        // If someone rejected and we're the caller, we might want to handle this
        // For now, just log it
      });
      subscriptionIds.current.push(rejectSubId);
  
      return () => {
        subscriptionIds.current.forEach((id) => socketManager.off(id));
        subscriptionIds.current = [];
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
        }
      };
    }, [isConnected, user?.id, activeCall?.roomId]);
  
    // Accept incoming call
    const acceptCall = useCallback(() => {
      if (!incomingCall) return;
  
      console.log('📹 [VideoCallContext] Accepting call:', incomingCall.roomId);
  
      // Clear timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
  
      const callData = { ...incomingCall };
      setIncomingCall(null);
  
      // Navigate to video call screen
      router.push({
        pathname: '/chat/video-call',
        params: {
          roomId: callData.roomId,
          roomName: callData.roomName,
          joining: 'true',
        },
      });
    }, [incomingCall]);
  
    // Reject incoming call
    const rejectCall = useCallback(() => {
      if (!incomingCall) return;
  
      console.log('📹 [VideoCallContext] Rejecting call:', incomingCall.roomId);
  
      // Clear timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
  
      // Send rejection to server
      socketManager.rejectVideoCall(incomingCall.roomId);
      
      setIncomingCall(null);
    }, [incomingCall]);
  
    // Initiate a new call
    const initiateCall = useCallback((roomId: string, roomName: string) => {
      console.log('📹 [VideoCallContext] Initiating call:', roomId);
  
      // Navigate to video call screen
      router.push({
        pathname: '/chat/video-call',
        params: {
          roomId,
          roomName,
          joining: 'false',
        },
      });
    }, []);
  
    // End active call
    const endCall = useCallback(() => {
      if (activeCall) {
        console.log('📹 [VideoCallContext] Ending call:', activeCall.roomId);
        socketManager.endVideoCall(activeCall.roomId);
        setActiveCall(null);
      }
    }, [activeCall]);
  
    // Clear incoming call without rejecting
    const clearIncomingCall = useCallback(() => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      setIncomingCall(null);
    }, []);
  
    const contextValue: VideoCallContextValue = {
      incomingCall,
      activeCall,
      acceptCall,
      rejectCall,
      initiateCall,
      endCall,
      setActiveCall,
      clearIncomingCall,
    };
  
    return (
      <VideoCallContext.Provider value={contextValue}>
        {children}
      </VideoCallContext.Provider>
    );
  }
  
  // ==================== HOOK ====================
  
  export function useVideoCall(): VideoCallContextValue {
    const context = useContext(VideoCallContext);
    if (!context) {
      throw new Error('useVideoCall must be used within VideoCallProvider');
    }
    return context;
  }