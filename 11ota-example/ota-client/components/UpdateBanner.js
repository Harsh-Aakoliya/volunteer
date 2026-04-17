import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import useOTAUpdates, { UPDATE_STATUS } from '../hooks/useOTAUpdates';

const { width } = Dimensions.get('window');

/**
 * Drop-in update banner component
 * 
 * Usage:
 *   <UpdateBanner />
 *   <UpdateBanner position="bottom" autoDownload />
 */
export default function UpdateBanner({
  position = 'top',
  autoDownload = false,
  autoApply = false,
  showWhenUpToDate = false,
  checkInterval = 0,
  style = {},
}) {
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

  const {
    status,
    error,
    updateInfo,
    checkForUpdate,
    downloadUpdate,
    applyUpdate,
    downloadAndApply,
  } = useOTAUpdates({
    autoCheck: true,
    autoDownload,
    autoApply,
    checkInterval,
    onUpdateAvailable: () => showBanner(),
    onUpdateReady: () => showBanner(),
    onError: () => showBanner(),
  });

  const showBanner = () => {
    setDismissed(false);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  // Don't render in DEV mode
  if (__DEV__) return null;

  // Don't show if dismissed or nothing to show
  const shouldShow =
    !dismissed &&
    (status === UPDATE_STATUS.AVAILABLE ||
      status === UPDATE_STATUS.DOWNLOADING ||
      status === UPDATE_STATUS.READY ||
      status === UPDATE_STATUS.ERROR ||
      (showWhenUpToDate && status === UPDATE_STATUS.UP_TO_DATE));

  if (!shouldShow) return null;

  const bgColor =
    status === UPDATE_STATUS.ERROR
      ? '#FF3B30'
      : status === UPDATE_STATUS.READY
        ? '#34C759'
        : '#007AFF';

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'bottom' ? styles.bottom : styles.top,
        { backgroundColor: bgColor, transform: [{ translateY: slideAnim }] },
        style,
      ]}
    >
      <View style={styles.content}>
        {/* Status icon/indicator */}
        {status === UPDATE_STATUS.DOWNLOADING && (
          <ActivityIndicator color="#fff" size="small" style={styles.indicator} />
        )}

        {/* Message */}
        <Text style={styles.text}>
          {status === UPDATE_STATUS.AVAILABLE && '🆕 A new update is available!'}
          {status === UPDATE_STATUS.DOWNLOADING && '⬇️ Downloading update...'}
          {status === UPDATE_STATUS.READY && '✅ Update ready! Restart to apply.'}
          {status === UPDATE_STATUS.ERROR && `❌ Update error: ${error}`}
          {status === UPDATE_STATUS.UP_TO_DATE && '✅ App is up to date'}
        </Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          {status === UPDATE_STATUS.AVAILABLE && (
            <TouchableOpacity style={styles.btn} onPress={downloadUpdate}>
              <Text style={styles.btnText}>Download</Text>
            </TouchableOpacity>
          )}

          {status === UPDATE_STATUS.READY && (
            <TouchableOpacity style={styles.btn} onPress={applyUpdate}>
              <Text style={styles.btnText}>Restart</Text>
            </TouchableOpacity>
          )}

          {status === UPDATE_STATUS.ERROR && (
            <TouchableOpacity style={styles.btn} onPress={checkForUpdate}>
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          )}

          {/* Dismiss */}
          <TouchableOpacity onPress={hideBanner} style={styles.dismiss}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  top: { top: 0, paddingTop: 50 },
  bottom: { bottom: 0, paddingBottom: 34 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indicator: { marginRight: 8 },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dismiss: { padding: 4, marginLeft: 4 },
  dismissText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: 'bold' },
});