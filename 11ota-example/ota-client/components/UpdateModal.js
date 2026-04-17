import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import useOTAUpdates, { UPDATE_STATUS } from '../hooks/useOTAUpdates';

/**
 * Modal that blocks the app when a mandatory update is available
 * 
 * Usage:
 *   <MandatoryUpdateModal />
 */
export default function MandatoryUpdateModal() {
  const {
    status,
    error,
    downloadAndApply,
    downloadUpdate,
    applyUpdate,
    checkForUpdate,
  } = useOTAUpdates({
    autoCheck: true,
    autoDownload: true,
  });

  // Only show for specific states
  const isVisible =
    status === UPDATE_STATUS.AVAILABLE ||
    status === UPDATE_STATUS.DOWNLOADING ||
    status === UPDATE_STATUS.READY;

  if (__DEV__ || !isVisible) return null;

  return (
    <Modal transparent animationType="fade" visible={isVisible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>
            {status === UPDATE_STATUS.DOWNLOADING ? '⬇️' : 
             status === UPDATE_STATUS.READY ? '🚀' : '🆕'}
          </Text>

          <Text style={styles.title}>
            {status === UPDATE_STATUS.AVAILABLE && 'Update Available'}
            {status === UPDATE_STATUS.DOWNLOADING && 'Downloading Update'}
            {status === UPDATE_STATUS.READY && 'Update Ready!'}
          </Text>

          <Text style={styles.subtitle}>
            {status === UPDATE_STATUS.AVAILABLE &&
              'A new version is available. Please update to continue.'}
            {status === UPDATE_STATUS.DOWNLOADING &&
              'Please wait while we download the latest version...'}
            {status === UPDATE_STATUS.READY &&
              'The update has been downloaded. Tap below to restart and apply.'}
          </Text>

          {status === UPDATE_STATUS.DOWNLOADING && (
            <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
          )}

          {status === UPDATE_STATUS.AVAILABLE && (
            <TouchableOpacity style={styles.button} onPress={downloadAndApply}>
              <Text style={styles.buttonText}>Update Now</Text>
            </TouchableOpacity>
          )}

          {status === UPDATE_STATUS.READY && (
            <TouchableOpacity style={[styles.button, { backgroundColor: '#34C759' }]} onPress={applyUpdate}>
              <Text style={styles.buttonText}>Restart App</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});