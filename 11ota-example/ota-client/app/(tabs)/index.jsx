import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import useOTAUpdates, { UPDATE_STATUS } from "@/hooks/useOTAUpdates.js";

export default function App() {
  const {
    status,
    updateInfo,
    error,
    lastCheckTime,
    currentInfo,
    checkForUpdate,
    downloadUpdate,
    applyUpdate,
    downloadAndApply,
  } = useOTAUpdates({
    autoCheck: true,
    autoDownload: false,
    checkInterval: 5 * 60 * 1000,
  });

  const statusColors = {
    [UPDATE_STATUS.IDLE]: '#888',
    [UPDATE_STATUS.CHECKING]: '#FF9500',
    [UPDATE_STATUS.AVAILABLE]: '#007AFF',
    [UPDATE_STATUS.DOWNLOADING]: '#FF9500',
    [UPDATE_STATUS.READY]: '#34C759',
    [UPDATE_STATUS.RESTARTING]: '#AF52DE',
    [UPDATE_STATUS.UP_TO_DATE]: '#34C759',
    [UPDATE_STATUS.ERROR]: '#FF3B30',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>Welcome to My ota application updator </Text>
          <Text style={styles.heroSubtitle}>
            This UI is served via OTA update.{'\n'}
            Change this text, push an update,{'\n'}
            and see it change without rebuilding! ✨
          </Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>
              Bundle v{currentInfo.appVersion || '1.0.0'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.serverBtn}
            onPress={async () => {
              try {
                const response = await fetch('http://10.179.99.242:3000/health');
                const data = await response.json();
                Alert.alert('Server OK', JSON.stringify(data, null, 2));
              } catch (err) {
                Alert.alert('Server Error', err.message);
              }
            }}
          >
            <Text style={styles.serverBtnText}>Check Server</Text>
          </TouchableOpacity>
        </View>

        {/* OTA Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OTA Update Status</Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]} />
            <Text style={styles.statusText}>{status.replace(/_/g, ' ').toUpperCase()}</Text>
          </View>

          {error && (
            <Text style={styles.errorText}>Error: {error}</Text>
          )}

          {lastCheckTime && (
            <Text style={styles.metaText}>
              Last checked: {lastCheckTime.toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Controls</Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF' }]}
            onPress={checkForUpdate}
            disabled={status === UPDATE_STATUS.CHECKING || status === UPDATE_STATUS.DOWNLOADING}
          >
            <Text style={styles.buttonText}>
              {status === UPDATE_STATUS.CHECKING ? '⏳ Checking...' : '🔍 Check for Updates'}
            </Text>
          </TouchableOpacity>

          {status === UPDATE_STATUS.AVAILABLE && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#FF9500' }]}
              onPress={downloadUpdate}
            >
              <Text style={styles.buttonText}>⬇️ Download Update</Text>
            </TouchableOpacity>
          )}

          {status === UPDATE_STATUS.READY && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#34C759' }]}
              onPress={applyUpdate}
            >
              <Text style={styles.buttonText}>🚀 Restart & Apply</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#AF52DE' }]}
            onPress={downloadAndApply}
            disabled={status === UPDATE_STATUS.CHECKING || status === UPDATE_STATUS.DOWNLOADING}
          >
            <Text style={styles.buttonText}>⚡ One-Tap Update</Text>
          </TouchableOpacity>
        </View>

        {/* Debug Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Info</Text>
          <View style={styles.debugCard}>
            <DebugRow label="Platform" value={Platform.OS} />
            <DebugRow label="App Version" value={currentInfo.appVersion} />
            <DebugRow label="Runtime Version" value={currentInfo.runtimeVersion} />
            <DebugRow label="Update ID" value={currentInfo.updateId ? currentInfo.updateId.substring(0, 12) + '...' : 'embedded'} />
            <DebugRow label="Is Embedded" value={String(currentInfo.isEmbeddedLaunch)} />
            <DebugRow label="Channel" value={currentInfo.channel || 'default'} />
            <DebugRow label="Created At" value={currentInfo.createdAt?.toISOString?.() || 'N/A'} />
            <DebugRow label="Server" value={Constants.expoConfig?.extra?.otaServerUrl || 'N/A'} />
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DebugRow({ label, value }) {
  return (
    <View style={styles.debugRow}>
      <Text style={styles.debugLabel}>{label}</Text>
      <Text style={styles.debugValue}>{value || 'N/A'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scrollContent: { padding: 16, paddingTop: 20 },

  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  heroSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  versionBadge: {
    marginTop: 16,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionText: { color: '#2E7D32', fontSize: 12, fontWeight: '600' },

  serverBtn: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  serverBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12 },

  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusText: { fontSize: 15, fontWeight: '600', color: '#333' },
  errorText: { color: '#FF3B30', fontSize: 13, marginTop: 4 },
  metaText: { color: '#888', fontSize: 12, marginTop: 4 },

  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  debugCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  debugLabel: { color: '#888', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  debugValue: { color: '#4FC3F7', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
