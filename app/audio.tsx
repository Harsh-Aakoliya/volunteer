import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Button,
    Animated,
    TouchableOpacity,
    Dimensions,
    Alert
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

// ====================================================================
// Component 1: Real-time Waveform Recorder (Using Waves Array)
// ====================================================================
const RealTimeWaveformRecorder = ({ waves, isRecording }: any) => {
    const MAX_VISIBLE_BARS = 80; // Maximum number of bars to show
    const BAR_WIDTH = 3;
    const BAR_SPACING = 1;
    const containerWidth = screenWidth * 0.8;

    // Calculate how many bars can fit in the container
    const totalBarWidth = BAR_WIDTH + BAR_SPACING;
    const maxBarsInContainer = Math.floor(containerWidth / totalBarWidth);

    // Color based on pitch level
    const getBarColor = (pitch: any) => {
        if (pitch > 0.7) return '#ff6b6b'; // High pitch - red
        if (pitch > 0.4) return '#4ecdc4'; // Medium pitch - teal
        if (pitch > 0.2) return '#45b7d1'; // Medium-low pitch - blue
        return '#25D366'; // Low pitch - green
    };

    const renderWaveformBars = () => {
        const bars = [];


        if (waves.length > 0) {
            // Show the most recent waves (right to left)
            const visibleWaves = waves.slice(-maxBarsInContainer);

            // Fill with empty bars first, then overlay with wave data
            for (let i = 0; i < maxBarsInContainer; i++) {
                const waveIndex = visibleWaves.length - maxBarsInContainer + i;
                const wave = waveIndex >= 0 ? visibleWaves[waveIndex] : null;

                bars.push(
                    <Animated.View
                        key={`wave-${i}-${wave?.id || i}`}
                        style={[
                            styles.realtimeWaveformBar,
                            {
                                height: wave ? wave.height : 1,
                                backgroundColor: wave ? getBarColor(wave.pitch) : 'rgba(255,255,255,0.1)',
                                marginRight: BAR_SPACING,
                            }
                        ]}
                    />
                );
            }
        } else {
            // Show empty bars when no waves
            for (let i = 0; i < maxBarsInContainer; i++) {
                bars.push(
                    <Animated.View
                        key={`empty-${i}`}
                        style={[
                            styles.realtimeWaveformBar,
                            {
                                height: 1,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                marginRight: BAR_SPACING,
                            }
                        ]}
                    />
                );
            }
        }

        return bars;
    };

    return (
        <View style={styles.realtimeWaveformContainer}>
            <View style={styles.waveformBarsContainer}>
                {renderWaveformBars()}
            </View>
            {isRecording && (
                <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingLabel}>
                        Recording... ({waves.length} waves)
                    </Text>
                </View>
            )}
        </View>
    );
};

// ====================================================================
// Component 2: WhatsApp-like Audio Message Bubble
// ====================================================================
const AudioMessageBubble = ({ recording, isOwn = false }: any) => {
    if (!recording || !recording.file) {
        return null;
    }

    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis);
            setPlaybackDuration(status.durationMillis);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
                recording.sound.stopAsync();
            }
        }
    };

    useEffect(() => {
        const sound = recording.sound;
        sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
        return () => {
            sound.setOnPlaybackStatusUpdate(null);
        };
    }, [recording]);

    const togglePlayback = async () => {
        if (isPlaying) {
            await recording.sound.pauseAsync();
        } else {
            await recording.sound.replayAsync();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = async (position: any) => {
        if (recording.sound) {
            await recording.sound.setPositionAsync(position);
            setPlaybackPosition(position);
        }
    };

    const getProgress = () => {
        if (playbackDuration === 0) return 0;
        return playbackPosition / playbackDuration;
    };

    const formatTime = (milliseconds: any) => {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${ minutes }:${ remainingSeconds.toString().padStart(2, '0') }`;
    };

    return (
        <View style={[styles.messageBubble, isOwn ? styles.ownMessage : styles.otherMessage]}>
            <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
                <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={20}
                    color={isOwn ? "#fff" : "#25D366"}
                />
            </TouchableOpacity>

            <View style={styles.waveformWrapper}>
                <CustomWaveform
                    waves={recording.waves || []}
                    isOwn={isOwn}
                    progress={getProgress()}
                    onSeek={handleSeek}
                    isPlaying={isPlaying}
                    duration={playbackDuration}
                />
            </View>

            <Text style={[styles.durationText, isOwn ? styles.ownDuration : styles.otherDuration]}>
                {formatTime(playbackDuration || recording.durationMillis || 0)}
            </Text>
        </View>
    );
};

AudioMessageBubble.displayName = 'AudioMessageBubble';

// ====================================================================
// Component 3: Interactive Custom Waveform Display
// ====================================================================
const CustomWaveform = ({ waves, isOwn, progress, onSeek, isPlaying, duration }: any) => {
    const MAX_BARS = 100;
    const BAR_WIDTH = 2;
    const BAR_SPACING = 1;
    const containerWidth = 250;

    // Color based on pitch level
    const getBarColor = (pitch: any, isPlayed: boolean) => {
        const baseColor = pitch > 0.7 ? '#ff6b6b' :
            pitch > 0.4 ? '#4ecdc4' :
                pitch > 0.2 ? '#45b7d1' : '#25D366';

        if (isPlayed) {
            return baseColor; // Full color for played portion
        } else {
            // Dimmed color for unplayed portion
            return isOwn ? 'rgba(255,255,255,0.3)' : '#E0E0E0';
        }
    };

    const handleSeek = (event: any) => {
        if (onSeek && duration) {
            const { locationX } = event.nativeEvent;
            const seekPosition = (locationX / containerWidth) * duration;
            onSeek(Math.max(0, Math.min(seekPosition, duration)));
        }
    };

    const renderWaveformBars = () => {
        const bars = [];

        if (waves && waves.length > 0) {
            const visibleWaves = waves.slice(-MAX_BARS);
            const currentPosition = progress * duration;

            for (let i = 0; i < MAX_BARS; i++) {
                const wave = visibleWaves[i] || null;
                const wavePosition = wave ? wave.position : 0;
                const isPlayed = wavePosition <= currentPosition;

                bars.push(
                    <TouchableOpacity
                        key={`wave-${i}-${wave?.id || i}`}
                        style={[
                            styles.customWaveformBar,
                            {
                                height: wave ? Math.max(wave.height * 0.8, 3) : 3,
                                backgroundColor: wave ? getBarColor(wave.pitch, isPlayed) : (isOwn ? 'rgba(255,255,255,0.2)' : '#E0E0E0'),
                                marginRight: BAR_SPACING,
                                opacity: wave ? 1 : 0.3,
                            }
                        ]}
                        onPress={(event) => {
                            if (wave) {
                                handleSeek(event);
                            }
                        }}
                        activeOpacity={0.7}
                    />
                );
            }
        } else {
            // Show empty bars
            for (let i = 0; i < MAX_BARS; i++) {
                bars.push(
                    <View
                        key={`empty-${i}`}
                        style={[
                            styles.customWaveformBar,
                            {
                                height: 3,
                                backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : '#E0E0E0',
                                marginRight: BAR_SPACING,
                                opacity: 0.3,
                            }
                        ]}
                    />
                );
            }
        }

        return bars;
    };

    return (
        <View style={styles.customWaveformContainer}>
            <TouchableOpacity style={styles.customWaveformBars} onPress={handleSeek} activeOpacity={0.8} >
                {renderWaveformBars()}
            </TouchableOpacity>
            {isPlaying && (
                <View style={[styles.playbackIndicator, { left: `${progress * 100}%` }]} />
)}
        </View>
    );
};

CustomWaveform.displayName = 'CustomWaveform';

// ====================================================================
// Main WhatsApp-like Audio Recording App
// ====================================================================
export default function App() {
    const [recording, setRecording] = useState(undefined);
    const [recordingStatus, setRecordingStatus] = useState({});
    const [currentRecording, setCurrentRecording] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [waves, setWaves] = useState([]); // Array to store waveform data

    async function startRecording() {
        try {
            // Stop any existing recording first
            if (recording) {
                // Only call stopAndUnloadAsync if method exists on the object
                if (typeof (recording as any).stopAndUnloadAsync === 'function') {
                    await (recording as any).stopAndUnloadAsync();
                }
                setRecording(undefined);
            }

            const perm = await Audio.requestPermissionsAsync();
            if (perm.status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync({
                ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
                ios: {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
                },
                android: {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
                }
            });

            newRecording.setOnRecordingStatusUpdate(status => {
                setRecordingStatus(status);

                // Add waveform data to waves array every 200ms
                if (status.isRecording && status.metering !== undefined) {
                    const currentPitch = status.metering;
                    const normalizedLevel = Math.max((currentPitch + 60) / 60, 0); // Normalize -60 to 0 dB range

                    const newWave = {
                        id: Date.now() + Math.random(),
                        height: Math.max(normalizedLevel * 50 + Math.random() * 10, 2),
                        pitch: normalizedLevel,
                        timestamp: Date.now(),
                        duration: status.durationMillis || 0,
                        rawPitch: currentPitch,
                        position: status.durationMillis || 0 // Store position for timeline
                    };

                    setWaves(prev => {
                        const newWaves = [...prev, newWave];
                        // Keep only the last 500 waves for performance (200ms intervals)
                        return newWaves.slice(-500);
                    });
                }
            });

            setRecording(newRecording as any);
            setIsRecording(true);
            setRecordingStatus({ isRecording: true, metering: -60 });
            setWaves([]); // Clear previous waves

        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
        }
    }

    async function stopRecording() {
        if (!recording) return;

        setIsRecording(false);
        setRecording(undefined);
        await (recording as any).stopAndUnloadAsync();

        const { sound, status } = await (recording as any).createNewLoadedSoundAsync();
        const newRecording = {
            sound: sound,
            duration: getDurationFormatted(status.durationMillis),
            durationMillis: status.durationMillis,
            file: (recording as any).getURI(),
            waves: [...waves], // Store the waveform data with the recording
        };
        setCurrentRecording(newRecording as any);
        setShowReview(true);
    }

    function sendRecording() {
        if (!currentRecording) return;
        setRecordings(prev => [...prev, { ...currentRecording, isOwn: true }]);
        setCurrentRecording(null);
        setShowReview(false);
    }

    function discardRecording() {
        if (!currentRecording) return;
        (currentRecording as any).sound?.unloadAsync?.();
        setCurrentRecording(null);
        setShowReview(false);
    }

    function getDurationFormatted(milliseconds: any) {
        if (milliseconds === undefined) return '0:00';
        const minutes = milliseconds / 1000 / 60;
        const seconds = Math.round((minutes - Math.floor(minutes)) * 60);
        return seconds < 10
            ? `${Math.floor(minutes)}:0${seconds}`
            : `${Math.floor(minutes)}:${seconds}`;
    }

    function renderRecordingInterface() {
        if (showReview && currentRecording) {
            return (
                <View style={styles.reviewContainer}>
                    <View style={styles.reviewBubble}>
                        <Text style={styles.reviewTitle}>Review Recording</Text>
                        {currentRecording && (
                            <AudioMessageBubble recording={currentRecording} isOwn={true} />
                        )}
                        <View style={styles.reviewActions}>
                            <TouchableOpacity onPress={discardRecording} style={styles.deleteButton}>
                                <Ionicons name="trash" size={24} color="#ff4444" />
                                <Text style={styles.deleteText}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={sendRecording} style={styles.sendButton}>
                                <Ionicons name="send" size={24} color="#fff" />
                                <Text style={styles.sendText}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            );
        }


        if (isRecording) {
            return (
                <View style={styles.recordingContainer}>
                    <View style={styles.recordingBubble}>
                        <View style={styles.recordingHeader}>
                            <Text style={styles.timerText}>
                                {getDurationFormatted(recordingStatus.durationMillis)}
                            </Text>
                        </View>
                        <RealTimeWaveformRecorder
                            waves={waves}
                            isRecording={isRecording}
                        />
                        <TouchableOpacity onPress={stopRecording} style={styles.stopButton}>
                            <Ionicons name="stop" size={24} color="#fff" />
                            <Text style={styles.stopText}>Stop & Review</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.startContainer}>
                <TouchableOpacity onPress={startRecording} style={styles.recordButton}>
                    <Ionicons name="mic" size={32} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.recordHint}>Hold to record audio message</Text>
            </View>
        );
    }

    function renderMessages() {
        return recordings.map((recordingLine: any, index: any) => (
            <View key={index} style={styles.messageContainer}>
                <AudioMessageBubble recording={recordingLine} isOwn={recordingLine.isOwn} />
                <Text style={styles.timestamp}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        ));
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Audio Messages</Text>
                <Text style={styles.headerSubtitle}>WhatsApp-like Voice Recording</Text>
            </View>

            text

            {/* Messages List */}
            <View style={styles.messagesContainer}>
                {renderMessages()}
            </View>

            {/* Recording Interface */}
            <View style={styles.recordingInterface}>
                {renderRecordingInterface()}
            </View>

            {/* Clear All Button */}
            {recordings.length > 0 && (
                <TouchableOpacity onPress={() => {
                    recordings.forEach((rec: any) => rec.sound.unloadAsync());
                    setRecordings([]);
                }} style={styles.clearButton}>
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                    <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// ====================================================================
// WhatsApp-like Styles
// ====================================================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },

    // Header Styles
    header: {
        backgroundColor: '#25D366',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 5,
    },

    // Messages Container
    messagesContainer: {
        flex: 1,
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    messageContainer: {
        marginVertical: 5,
        alignItems: 'flex-end',
    },
    timestamp: {
        fontSize: 12,
        color: '#666',
        marginTop: 5,
        marginRight: 10,
    },

    // Message Bubble Styles
    messageBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 20,
        maxWidth: screenWidth * 0.8,
        minWidth: 200,
    },
    ownMessage: {
        backgroundColor: '#25D366',
        borderBottomRightRadius: 5,
    },
    otherMessage: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    waveformWrapper: {
        flex: 1,
        marginHorizontal: 10,
    },
    durationText: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 10,
    },
    ownDuration: {
        color: '#fff',
    },
    otherDuration: {
        color: '#25D366',
    },

    // Recording Interface
    recordingInterface: {
        backgroundColor: '#fff',
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },

    // Start Recording
    startContainer: {
        alignItems: 'center',
    },
    recordButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#25D366',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    recordHint: {
        marginTop: 15,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },

    // Recording State
    recordingContainer: {
        alignItems: 'center',
    },
    recordingBubble: {
        backgroundColor: '#2c2c2c',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 25,
        alignItems: 'center',
        minWidth: screenWidth * 0.8,
    },
    recordingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 15,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ff4444',
        marginRight: 8,
    },
    recordingText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    timerText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
        width: '100%',
        marginBottom: 15,
    },
    waveformBar: {
        width: 2,
        borderRadius: 1,
        marginHorizontal: 1,
    },
    stopButton: {
        backgroundColor: '#ff4444',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    stopText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },

    // Review State
    reviewContainer: {
        alignItems: 'center',
    },
    reviewBubble: {
        backgroundColor: '#f8f8f8',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 20,
        alignItems: 'center',
        width: '100%',
    },
    reviewTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    reviewActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 20,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,68,68,0.1)',
    },
    deleteText: {
        color: '#ff4444',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#25D366',
    },
    sendText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },

    // Clear Button
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        marginBottom: 20,
    },
    clearText: {
        color: '#ff4444',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },

    // Real-time Waveform Styles
    realtimeWaveformContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 15,
    },
    waveformBarsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 25,
        paddingHorizontal: 10,
        overflow: 'hidden',
    },
    realtimeWaveformBar: {
        width: 3,
        borderRadius: 1.5,
        backgroundColor: '#25D366',
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    recordingLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Custom Waveform Styles
    customWaveformContainer: {
        width: 250,
        height: 30,
        justifyContent: 'center',
        position: 'relative',
    },
    customWaveformBars: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
    },
    customWaveformBar: {
        width: 2,
        borderRadius: 1,
    },
    playbackIndicator: {
        position: 'absolute',
        top: 0,
        width: 2,
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 1,
        zIndex: 10,
    },
});