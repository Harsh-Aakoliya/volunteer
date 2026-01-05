// components/GlobalVideoCallNotification.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoCall } from '@/contexts/VideoCallContext';
import VideoCallNotification from './chat/VideoCallNotification';

export default function GlobalVideoCallNotification() {
  const { incomingCall, acceptCall, rejectCall } = useVideoCall();

  if (!incomingCall) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <VideoCallNotification
        visible={true}
        callerName={incomingCall.callerName}
        roomName={incomingCall.roomName}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});