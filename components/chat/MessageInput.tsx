// components/chat/MessageInput.tsx

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { getReplyPreviewText } from '@/utils/messageHelpers';
import DateTimePicker from '@/components/chat/DateTimePicker';
import {
  RichEditor,
  RichToolbar,
  actions,
  cleanHtml,
  stripHtml,
  isHtmlContent,
  ColorIndicatorIcon,
  InlineColorPicker,
  InlineLinkInput,
  ToolbarButton,
  LinkPreview,
} from '@/components/chat/message';

// ---------- TYPES ----------
interface MessageInputProps {
  messageText: string;
  onChangeText: (text: string) => void;
  onSend: (
    text: string,
    messageType: string,
    mediafilesId: number,
    tableId: number,
    pollId: number,
    scheduledAt?: string
  ) => void;
  placeholder?: string;
  sending?: boolean;
  disabled?: boolean;
  currentUser?: { userId: string; fullName: string | null } | null;
  replyToMessage?: any | null;
  onCancelReply?: () => void;
  onAttachmentPress?: () => void;
  isAttachmentSheetOpen?: boolean;
  onSendAudio?: (audioUri: string) => void | Promise<void>;
  showAttachmentButton?: boolean;
  showAudioButton?: boolean;
  initialContent?: string;
  sendIconName?: string;
  showScheduleOption?: boolean;
  containerClassName?: string;
  allowEmptySend?: boolean;
  /** Speech recognition language (default 'en-US') */
  speechLanguage?: string;
}

// ---------- LANGUAGE OPTIONS ----------
interface LanguageOption {
  code: string;
  label: string;
  shortLabel: string;
}

const SPEECH_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', label: 'English', shortLabel: 'ENG' },
  { code: 'hi-IN', label: 'Hindi', shortLabel: 'हिन्दी' },
  { code: 'gu-IN', label: 'Gujarati', shortLabel: 'ગુજરાતી' },
];

// ---------- HELPER (link detection for preview) ----------
const extractLinks = (text: string): string[] => {
  const plainText = stripHtml(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return plainText.match(urlRegex) || [];
};

// ---------- PULSING MIC COMPONENT ----------
const PulsingMicButton = ({
  onPress,
  isListening,
  disabled,
}: {
  onPress: () => void;
  isListening: boolean;
  disabled?: boolean;
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (isListening) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.3,
              duration: 800,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 800,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.6);
    }
  }, [isListening, pulseAnim, opacityAnim]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="min-h-[50px] min-w-[50px] items-center justify-center mb-0"
    >
      {isListening && (
        <Animated.View
          style={{
            position: 'absolute',
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: '#16a34a',
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          }}
        />
      )}
      <View
        className="min-h-[50px] min-w-[50px] rounded-full items-center justify-center bg-green-600"
        style={{
          shadowColor: '#16a34a',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 3,
          elevation: 3,
        }}
      >
        <Ionicons name={isListening ? 'stop' : 'mic'} size={24} color="#fff" />
      </View>
    </Pressable>
  );
};

// ---------- LANGUAGE PILL BUTTON ----------
const LanguagePill = ({
  lang,
  isSelected,
  onPress,
}: {
  lang: LanguageOption;
  isSelected: boolean;
  onPress: () => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  }, [onPress, scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 16,
          marginHorizontal: 2,
          backgroundColor: isSelected ? '#16a34a' : '#FFFFFF',
          borderWidth: 1.5,
          borderColor: isSelected ? '#16a34a' : '#E5E7EB',
          shadowColor: isSelected ? '#16a34a' : '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isSelected ? 0.3 : 0.08,
          shadowRadius: 2,
          elevation: isSelected ? 3 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: isSelected ? '#FFFFFF' : '#16a34a',
            letterSpacing: 0.3,
          }}
        >
          {lang.shortLabel}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ---------- SPEECH-TO-TEXT INDICATOR ----------
const SpeechToTextIndicator = ({
  isListening,
  partialResult,
  onStop,
  selectedLanguage,
  onLanguageChange,
}: {
  isListening: boolean;
  partialResult: string;
  onStop: () => void;
  selectedLanguage: string;
  onLanguageChange: (langCode: string) => void;
}) => {
  const waveAnim1 = useRef(new Animated.Value(0.3)).current;
  const waveAnim2 = useRef(new Animated.Value(0.3)).current;
  const waveAnim3 = useRef(new Animated.Value(0.3)).current;
  const waveAnim4 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isListening) {
      const createWaveAnimation = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const animations = [
        createWaveAnimation(waveAnim1, 0),
        createWaveAnimation(waveAnim2, 100),
        createWaveAnimation(waveAnim3, 200),
        createWaveAnimation(waveAnim4, 300),
      ];

      animations.forEach((anim) => anim.start());

      return () => animations.forEach((anim) => anim.stop());
    }
  }, [isListening, waveAnim1, waveAnim2, waveAnim3, waveAnim4]);

  if (!isListening) return null;

  return (
    <View className="bg-green-50 border-t border-green-200 px-4 py-3">
      {/* Listening + wave + inline language pills */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          {/* Sound wave animation */}
          <View className="flex-row items-center mr-3 h-6">
            {[waveAnim1, waveAnim2, waveAnim3, waveAnim4].map((anim, index) => (
              <Animated.View
                key={index}
                style={{
                  width: 3,
                  height: 20,
                  backgroundColor: '#16a34a',
                  marginHorizontal: 2,
                  borderRadius: 2,
                  transform: [{ scaleY: anim }],
                }}
              />
            ))}
          </View>

          <View className="flex-1">
            <Text className="text-green-700 font-semibold text-sm">
              Listening...
            </Text>
            {partialResult ? (
              <Text
                className="text-gray-600 text-xs mt-0.5"
                numberOfLines={1}
              >
                "{partialResult}"
              </Text>
            ) : (
              <Text className="text-gray-400 text-xs mt-0.5">Speak now</Text>
            )}
          </View>
        </View>

        {/* Compact language pills to the right */}
        <View className="flex-row items-center ml-3">
          {SPEECH_LANGUAGES.map((lang) => (
            <LanguagePill
              key={lang.code}
              lang={lang}
              isSelected={selectedLanguage === lang.code}
              onPress={() => onLanguageChange(lang.code)}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// ---------- MAIN COMPONENT ----------
export default function MessageInput({
  messageText,
  onChangeText,
  onSend,
  placeholder = 'Message',
  sending = false,
  currentUser,
  replyToMessage,
  onCancelReply,
  onAttachmentPress,
  isAttachmentSheetOpen = false,
  onSendAudio,
  showAttachmentButton = true,
  showAudioButton,
  initialContent,
  sendIconName = 'send',
  showScheduleOption = true,
  containerClassName = 'bg-[#E5DDD5] w-full pb-1',
  allowEmptySend = false,
  speechLanguage = 'en-US',
}: MessageInputProps) {
  // Refs
  const inputRef = useRef<TextInput>(null);
  const richTextRef = useRef<any>(null);
  const editorKeyRef = useRef(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const heightUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const textBeforeSpeechRef = useRef('');
  const ignoreNextSpeechEndRef = useRef(false);

  // State
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const [showColorPicker, setShowColorPicker] = useState<
    'text' | 'background' | null
  >(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<string[]>([]);
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [currentBgColor, setCurrentBgColor] = useState('#FFFFFF');

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCustomTimePicker, setShowCustomTimePicker] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState<Date | null>(
    null
  );
  const [customScheduleTime, setCustomScheduleTime] = useState<string | null>(
    null
  );

  const [formatActive, setFormatActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  });
  const [listAlignActive, setListAlignActive] = useState({
    bullet: false,
    number: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false,
  });

  // Audio recording state
  const [recordingMode, setRecordingMode] = useState<
    'idle' | 'recording' | 'paused'
  >('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);

  // Speech-to-text state
  const [speechToTextActive, setSpeechToTextActive] = useState(false);
  const [partialSpeechResult, setPartialSpeechResult] = useState('');
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [activeSpeechLang, setActiveSpeechLang] = useState<string>(
    speechLanguage
  );

  const isAudioAvailable = !!onSendAudio && (showAudioButton ?? true);

  // Check if speech recognition is available
  useEffect(() => {
    if (Platform.OS === 'web') {
      setSpeechAvailable(false);
      return;
    }

    try {
      setSpeechAvailable(
        ExpoSpeechRecognitionModule.isRecognitionAvailable()
      );
    } catch {
      setSpeechAvailable(false);
    }
  }, []);

  // Setup Speech Recognition listeners
  useSpeechRecognitionEvent('start', () => {
    if (Platform.OS === 'web') return;
    setSpeechToTextActive(true);
  });

  useSpeechRecognitionEvent('end', () => {
    if (Platform.OS === 'web') return;
    if (ignoreNextSpeechEndRef.current) {
      ignoreNextSpeechEndRef.current = false;
      return;
    }
    setSpeechToTextActive(false);
    setPartialSpeechResult('');
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    if (Platform.OS === 'web') return;
    console.error('Speech error:', event?.error, event?.message);
    setSpeechToTextActive(false);
    setPartialSpeechResult('');

    if (event?.error === 'no-speech') return;
    if (
      event?.error === 'audio-capture' ||
      event?.error === 'not-allowed'
    ) {
      Alert.alert(
        'Microphone Error',
        'Could not access microphone. Please check permissions.'
      );
      return;
    }
    Alert.alert('Speech Recognition', 'An error occurred. Please try again.');
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    if (Platform.OS === 'web') return;

    const ri =
      typeof event?.resultIndex === 'number' ? event.resultIndex : 0;
    let transcript = '';

    if (Array.isArray(event?.results)) {
      const maybeNested = event.results?.[ri];
      if (Array.isArray(maybeNested)) {
        transcript = maybeNested?.[0]?.transcript || '';
      } else {
        transcript = event.results?.[0]?.transcript || '';
      }
    }

    const isFinal =
      !!event?.isFinal ||
      !!event?.results?.[ri]?.[0]?.isFinal ||
      !!event?.results?.[0]?.isFinal;

    if (!transcript) return;

    if (isFinal) {
      const existingText = textBeforeSpeechRef.current;
      const newContent = existingText
        ? `${existingText} ${transcript}`
        : transcript;

      onChangeText(newContent);
      richTextRef.current?.setContentHTML(newContent);

      textBeforeSpeechRef.current = newContent;
      setPartialSpeechResult('');
    } else {
      setPartialSpeechResult(transcript);

      const existingText = textBeforeSpeechRef.current;
      const partialContent = existingText
        ? `${existingText} ${transcript}`
        : transcript;

      richTextRef.current?.setContentHTML(partialContent);
      onChangeText(partialContent);
    }
  });

  // Start speech-to-text
  const startSpeechToText = useCallback(
    async (langOverride?: string) => {
      if (Platform.OS === 'web' || !speechAvailable) {
        Alert.alert(
          'Not Available',
          'Speech recognition is not available on this device.'
        );
        return;
      }

      try {
        const result =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();

        if (!result?.granted) {
          Alert.alert(
            'Permission Required',
            'Please grant microphone permission to use speech recognition.'
          );
          return;
        }

        // Store current text before starting
        textBeforeSpeechRef.current = stripHtml(messageText).trim();

        // Close any open UI elements
        setShowRichTextToolbar(false);
        setShowColorPicker(null);
        setShowLinkInput(false);

        const langToUse = langOverride || activeSpeechLang;

        // Start recognition with chosen language
        ExpoSpeechRecognitionModule.start({
          lang: langToUse,
          interimResults: true,
          continuous: true,
          maxAlternatives: 1,
        });

        setSpeechToTextActive(true);
      } catch (e: any) {
        console.error('Failed to start speech recognition:', e);
        Alert.alert(
          'Error',
          'Could not start speech recognition. Please try again.'
        );
      }
    },
    [messageText, activeSpeechLang, speechAvailable]
  );

  // Stop speech-to-text
  const stopSpeechToText = useCallback(async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
      setSpeechToTextActive(false);
      setPartialSpeechResult('');
    } catch (e) {
      console.error('Failed to stop speech recognition:', e);
      setSpeechToTextActive(false);
      setPartialSpeechResult('');
    }
  }, []);

  // Switch language while listening – stop current, change lang, restart
  const handleSpeechLanguageChange = useCallback(
    async (langCode: string) => {
      if (langCode === activeSpeechLang && speechToTextActive) return;

      setActiveSpeechLang(langCode);

      if (speechToTextActive) {
        // Stop current recognition, then restart with new language
        try {
          ignoreNextSpeechEndRef.current = true;
          ExpoSpeechRecognitionModule.stop();
        } catch (_) {}

        // Small delay to let the engine fully stop before restarting
        setTimeout(async () => {
          try {
            textBeforeSpeechRef.current = stripHtml(messageText).trim();

            ExpoSpeechRecognitionModule.start({
              lang: langCode,
              interimResults: true,
              continuous: true,
              maxAlternatives: 1,
            });
            setSpeechToTextActive(true);
            setPartialSpeechResult('');
          } catch (e) {
            console.error('Failed to restart speech recognition:', e);
            setSpeechToTextActive(false);
          }
        }, 350);
      }
    },
    [activeSpeechLang, speechToTextActive, messageText]
  );

  // Handle long press on mic for speech-to-text
  const handleLongPressMic = useCallback(async () => {
    if (speechToTextActive) {
      await stopSpeechToText();
    } else {
      await startSpeechToText();
    }
  }, [speechToTextActive, startSpeechToText, stopSpeechToText]);

  // Handle tap on mic when speech-to-text is active
  const handleMicPress = useCallback(async () => {
    if (speechToTextActive) {
      await stopSpeechToText();
    } else if (isAudioAvailable) {
      handleStartRecording();
    }
  }, [speechToTextActive, stopSpeechToText, isAudioAvailable]);

  // Set initial content when editor mounts (for edit mode)
  useEffect(() => {
    if (!initialContent) return;
    const t = setTimeout(() => {
      richTextRef.current?.setContentHTML(initialContent);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  // Audio permissions and mode
  useEffect(() => {
    if (!isAudioAvailable || Platform.OS === 'web') return;
    const setup = async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.error('Audio setup failed:', e);
      }
    };
    setup();
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (previewSoundRef.current) previewSoundRef.current.unloadAsync();
    };
  }, [isAudioAvailable]);

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = useCallback(async () => {
    if (!onSendAudio) return;

    // Stop speech-to-text if active
    if (speechToTextActive) {
      await stopSpeechToText();
    }

    try {
      setShowRichTextToolbar(false);
      setShowColorPicker(null);
      setShowLinkInput(false);
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecordingMode('recording');
      setRecordingDuration(0);
      setRecordedUri(null);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      Alert.alert(
        'Recording',
        'Could not start recording. Please allow microphone access.'
      );
    }
  }, [onSendAudio, speechToTextActive, stopSpeechToText]);

  const handlePauseRecording = useCallback(async () => {
    if (recordingRef.current) {
      await recordingRef.current.pauseAsync();
      setRecordingMode('paused');
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, []);

  const handleResumeRecording = useCallback(async () => {
    if (recordingRef.current) {
      await recordingRef.current.startAsync();
      setRecordingMode('recording');
      setPreviewPlaying(false);
      if (previewSoundRef.current) {
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  }, []);

  const handleDeleteRecording = useCallback(async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (previewSoundRef.current) {
      await previewSoundRef.current.unloadAsync();
      previewSoundRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (_) {}
      recordingRef.current = null;
    }
    setRecordingMode('idle');
    setRecordingDuration(0);
    setRecordedUri(null);
    setPreviewPlaying(false);
    setPreviewDuration(0);
    setPreviewPosition(0);
  }, []);

  const handleSendAudio = useCallback(async () => {
    if (!onSendAudio) return;
    const uri = recordedUri;
    if (recordingRef.current && !uri) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const u = recordingRef.current.getURI();
        recordingRef.current = null;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (!u) {
          setSendingAudio(false);
          return;
        }
        setSendingAudio(true);
        await onSendAudio(u);
        handleDeleteRecording();
      } catch (e) {
        Alert.alert('Send failed', 'Could not send audio.');
      } finally {
        setSendingAudio(false);
      }
      return;
    }
    if (uri) {
      setSendingAudio(true);
      try {
        await onSendAudio(uri);
        handleDeleteRecording();
      } catch (e) {
        Alert.alert('Send failed', 'Could not send audio.');
      } finally {
        setSendingAudio(false);
      }
    }
  }, [onSendAudio, recordedUri, handleDeleteRecording]);

  const handlePlayPreview = useCallback(async () => {
    if (!recordedUri) return;
    if (previewSoundRef.current) {
      try {
        await previewSoundRef.current.setPositionAsync(0);
        setPreviewPosition(0);
      } catch (_) {}
      await previewSoundRef.current.playAsync();
      setPreviewPlaying(true);
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true, progressUpdateIntervalMillis: 300 },
        (s) => {
          if (!s.isLoaded) return;
          const pos = (s.positionMillis ?? 0) / 1000;
          const dur = (s.durationMillis ?? 0) / 1000;
          setPreviewPosition(pos);
          if (dur > 0) setPreviewDuration(dur);
          if (
            (s as any).didJustFinishAndNotJustLooped ??
            (s as any).didJustFinish
          ) {
            setPreviewPosition(0);
            setPreviewPlaying(false);
          }
        }
      );
      previewSoundRef.current = sound;
      setPreviewPlaying(true);
    } catch (_) {}
  }, [recordedUri]);

  const handlePausePreview = useCallback(async () => {
    if (previewSoundRef.current) {
      await previewSoundRef.current.pauseAsync();
      setPreviewPlaying(false);
    }
  }, []);

  // When replying, focus input after short delay
  useEffect(() => {
    if (!replyToMessage || recordingMode !== 'idle') return;
    const t = setTimeout(() => {
      richTextRef.current?.focusContentEditor?.();
    }, 100);
    return () => clearTimeout(t);
  }, [replyToMessage, recordingMode]);

  // Link detection
  useEffect(() => {
    const links = extractLinks(messageText);
    setLinkPreviews(links);
  }, [messageText]);

  // Close toolbar handler
  const handleCloseToolbar = useCallback(() => {
    setShowColorPicker(null);
    setShowLinkInput(false);
    setShowRichTextToolbar(false);
  }, []);

  // Color picker handlers
  const handleColorSelect = useCallback(
    (color: string) => {
      if (showColorPicker === 'text') {
        richTextRef.current?.setForeColor(color);
        setCurrentTextColor(color);
      } else if (showColorPicker === 'background') {
        richTextRef.current?.setHiliteColor(color);
        setCurrentBgColor(color);
      }
      setShowColorPicker(null);

      setTimeout(() => {
        richTextRef.current?.focusContentEditor();
      }, 50);
    },
    [showColorPicker]
  );

  const toggleColorPicker = useCallback((type: 'text' | 'background') => {
    setShowLinkInput(false);
    setShowColorPicker((prev) => (prev === type ? null : type));
  }, []);

  // Link handlers
  const handleInsertLink = useCallback(
    (url: string, text: string) => {
      if (richTextRef.current) {
        richTextRef.current?.insertLink(text, url);
      } else {
        onChangeText(messageText + ` ${url} `);
      }
    },
    [messageText, onChangeText]
  );

  const toggleLinkInput = useCallback(() => {
    setShowColorPicker(null);
    setShowLinkInput((prev) => !prev);
  }, []);

  const handlePaste = useCallback((data: string) => {
    if (!data || !richTextRef.current) return;
    if (isHtmlContent(data)) {
      richTextRef.current.insertHTML(data);
    }
  }, []);

  const handleRemoveLinkPreview = useCallback(
    (url: string) => {
      const newText = messageText.replace(url, '').trim();
      onChangeText(newText);
    },
    [messageText, onChangeText]
  );

  // Computed values
  const isEmpty = useMemo(() => {
    return stripHtml(messageText).trim().length === 0;
  }, [messageText]);

  const resetAfterSend = useCallback(() => {
    onChangeText('');
    setInputHeight(40);
    setLinkPreviews([]);
    setShowColorPicker(null);
    setShowLinkInput(false);
    setCurrentTextColor('#000000');
    setCurrentBgColor('#FFFFFF');
    setFormatActive({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
    });
    setListAlignActive({
      bullet: false,
      number: false,
      alignLeft: true,
      alignCenter: false,
      alignRight: false,
    });
    setShowRichTextToolbar(false);
    textBeforeSpeechRef.current = '';
    setTimeout(() => {
      if (richTextRef.current) {
        richTextRef.current.setContentHTML('');
      } else if (inputRef.current) {
        inputRef.current.clear();
      }
    }, 50);
  }, [onChangeText]);

  // Send handler
  const handleSendPress = useCallback(async () => {
    if (speechToTextActive) {
      await stopSpeechToText();
    }

    if (isEmpty && !allowEmptySend) {
      if (replyToMessage) return;
      if (showAttachmentButton && onAttachmentPress) {
        richTextRef.current?.blurContentEditor();
        inputRef.current?.blur();
        setTimeout(() => {
          onAttachmentPress?.();
        }, 100);
      }
      return;
    }
    const contentToSend = isEmpty ? '' : cleanHtml(messageText);
    onSend(contentToSend, 'text', 0, 0, 0);
    resetAfterSend();
  }, [
    isEmpty,
    replyToMessage,
    messageText,
    onSend,
    onAttachmentPress,
    resetAfterSend,
    showAttachmentButton,
    allowEmptySend,
    speechToTextActive,
    stopSpeechToText,
  ]);

  const handleScheduleSend = useCallback(
    (scheduledAt: string) => {
      if (isEmpty) return;
      const contentToSend = cleanHtml(messageText);
      onSend(contentToSend, 'text', 0, 0, 0, scheduledAt);
      setShowScheduleModal(false);
      setShowCustomTimePicker(false);
      setCustomScheduleDate(null);
      setCustomScheduleTime(null);
      resetAfterSend();
    },
    [isEmpty, messageText, onSend, resetAfterSend]
  );

  const handleLongPressSend = useCallback(() => {
    if (isEmpty) return;
    setShowScheduleModal(true);
  }, [isEmpty]);

  const maxInputHeight = 7 * 22 + 20;

  const shouldShowToolbar =
    showRichTextToolbar &&
    Platform.OS !== 'web' &&
    RichToolbar &&
    recordingMode === 'idle' &&
    !speechToTextActive;

  return (
    <View className={containerClassName}>
      {/* Speech-to-Text Indicator */}
      <SpeechToTextIndicator
        isListening={speechToTextActive}
        partialResult={partialSpeechResult}
        onStop={stopSpeechToText}
        selectedLanguage={activeSpeechLang}
        onLanguageChange={handleSpeechLanguageChange}
      />

      {/* Link Previews */}
      {linkPreviews.length > 0 && !speechToTextActive && (
        <View className="px-3 pt-2 pb-1">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          >
            {linkPreviews.map((url, index) => (
              <LinkPreview
                key={index}
                url={url}
                onRemove={() => handleRemoveLinkPreview(url)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main Input Area */}
      {recordingMode !== 'idle' && isAudioAvailable ? (
        // Recording View
        <View className="px-3 py-2 bg-white">
          <View className="flex-row items-center mb-3">
            {recordingMode === 'recording' ? (
              <>
                <Text className="text-base font-semibold text-gray-900 mr-2">
                  {formatRecordingTime(recordingDuration)}
                </Text>
                <Text className="text-sm text-gray-500">Recording...</Text>
              </>
            ) : recordedUri ? (
              <>
                <TouchableOpacity
                  onPress={
                    previewPlaying ? handlePausePreview : handlePlayPreview
                  }
                  className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-2"
                >
                  <Ionicons
                    name={previewPlaying ? 'pause' : 'play'}
                    size={22}
                    color="#374151"
                  />
                </TouchableOpacity>
                <View className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden mx-2">
                  <View
                    className="h-full bg-green-600 rounded-full"
                    style={{
                      width: `${
                        previewDuration > 0
                          ? (previewPosition / previewDuration) * 100
                          : 0
                      }%`,
                    }}
                  />
                </View>
                <Text
                  className="text-base font-semibold text-gray-900 ml-0"
                  style={{ minWidth: 36 }}
                >
                  {previewPlaying
                    ? formatRecordingTime(Math.floor(previewPosition))
                    : formatRecordingTime(
                        previewDuration > 0
                          ? Math.floor(previewDuration)
                          : recordingDuration
                      )}
                </Text>
              </>
            ) : (
              <>
                <Text className="text-base font-semibold text-gray-900 mr-2">
                  {formatRecordingTime(recordingDuration)}
                </Text>
                <Text className="text-sm text-gray-500">Paused</Text>
              </>
            )}
          </View>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={handleDeleteRecording} className="p-2">
              <Ionicons name="trash-outline" size={24} color="#6b7280" />
            </TouchableOpacity>
            {recordingMode === 'recording' ? (
              <TouchableOpacity
                onPress={handlePauseRecording}
                className="p-2"
              >
                <Ionicons name="pause" size={28} color="#dc2626" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleResumeRecording}
                className="p-2"
              >
                <Ionicons name="mic" size={28} color="#dc2626" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSendAudio}
              disabled={sendingAudio}
              className="w-10 h-10 rounded-full bg-green-600 items-center justify-center min-h-[40px]"
              style={{
                shadowColor: '#1DAB61',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              {sendingAudio ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Normal Input View
        <View className="px-2 pt-1">
          <View className="flex-row items-end">
            <View className="flex-1 bg-white rounded-[22px] border border-gray-200 overflow-hidden mr-2 min-h-[44px]">
              {replyToMessage && (
                <View className="mt-2 mx-2 mb-1 p-2 bg-gray-100 rounded-lg border-l-[4px] border-green-600 flex-row items-start justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-green-600 text-xs font-bold mb-0.5">
                      {replyToMessage.senderId === currentUser?.userId
                        ? 'You'
                        : replyToMessage.senderName}
                    </Text>
                    <Text
                      className="text-gray-600 text-xs"
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {getReplyPreviewText(replyToMessage)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onCancelReply}
                    className="bg-gray-200 rounded-full p-0.5 mt-0.5"
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Ionicons name="close" size={14} color="#666" />
                  </TouchableOpacity>
                </View>
              )}

              <View
                className="flex-row items-center px-1 pb-1"
                style={{ maxHeight: maxInputHeight }}
              >
                <View
                  className="flex-1 justify-center"
                  style={{ paddingVertical: 2, paddingLeft: 6 }}
                >
                  {Platform.OS !== 'web' && RichEditor ? (
                    <RichEditor
                      key={`editor-${editorKeyRef.current}`}
                      ref={richTextRef}
                      onChange={onChangeText}
                      placeholder={placeholder}
                      placeholderTextColor="#4B5563"
                      initialContentHTML=""
                      initialHeight={40}
                      androidHardwareAccelerationDisabled={true}
                      androidLayerType="software"
                      pasteAsPlainText={true}
                      onPaste={handlePaste}
                      scrollEnabled={true}
                      showsVerticalScrollIndicator={false}
                      editorStyle={{
                        backgroundColor: 'transparent',
                        placeholderColor: '#4B5563',
                        contentCSSText: `
                          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                          font-size: 16px;
                          font-weight: 400;
                          line-height: 22px;
                          color: #1F2937;
                          padding: 8px 0px; 
                          min-height: 36px;
                          max-height: ${maxInputHeight - 20}px;
                          overflow-y: scroll;
                          overflow-x: hidden;
                          scrollbar-width: none;
                          -ms-overflow-style: none;
                          -webkit-overflow-scrolling: touch;
                        `,
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        minHeight: 36,
                        maxHeight: maxInputHeight - 20,
                      }}
                    />
                  ) : (
                    <TextInput
                      ref={inputRef}
                      value={messageText}
                      onChangeText={onChangeText}
                      placeholder={placeholder}
                      placeholderTextColor="#9CA3AF"
                      multiline
                      className="text-base text-gray-800"
                      style={{
                        minHeight: 40,
                        height: inputHeight,
                        maxHeight: maxInputHeight - 20,
                        lineHeight: 22,
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                      }}
                      onContentSizeChange={(event) => {
                        const contentHeight =
                          event.nativeEvent?.contentSize?.height;
                        if (!contentHeight) return;
                        if (heightUpdateTimeoutRef.current)
                          clearTimeout(heightUpdateTimeoutRef.current);
                        heightUpdateTimeoutRef.current = setTimeout(() => {
                          const newHeight = Math.min(
                            Math.max(40, Math.ceil(contentHeight)),
                            maxInputHeight
                          );
                          if (Math.abs(newHeight - inputHeight) >= 2)
                            setInputHeight(newHeight);
                        }, 50);
                      }}
                      scrollEnabled={inputHeight >= maxInputHeight - 20}
                    />
                  )}
                </View>

                <View className="flex-row items-center justify-end pr-1">
                  {!showRichTextToolbar &&
                    Platform.OS !== 'web' &&
                    !speechToTextActive && (
                      <>
                        {isEmpty &&
                          showAttachmentButton &&
                          onAttachmentPress && (
                            <TouchableOpacity
                              onPress={onAttachmentPress}
                              className="p-1"
                            >
                              <Ionicons
                                name="attach"
                                size={24}
                                color="#4B5563"
                              />
                            </TouchableOpacity>
                          )}
                        <TouchableOpacity
                          onPress={() => {
                            setShowRichTextToolbar(true);
                            setTimeout(
                              () =>
                                richTextRef.current?.focusContentEditor(),
                              100
                            );
                          }}
                          className="p-2"
                        >
                          <Ionicons name="text" size={24} color="#4B5563" />
                        </TouchableOpacity>
                      </>
                    )}
                </View>
              </View>
            </View>

            {/* Right: Send / Mic Button */}
            {isEmpty && isAudioAvailable && !speechToTextActive ? (
              <Pressable
                onPress={handleMicPress}
                onLongPress={handleLongPressMic}
                delayLongPress={500}
                disabled={sending}
                className="min-h-[50px] min-w-[50px] rounded-full bg-green-600 items-center justify-center mb-0"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  elevation: 3,
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="mic" size={24} color="#fff" />
                )}
              </Pressable>
            ) : speechToTextActive ? (
              <PulsingMicButton
                onPress={stopSpeechToText}
                isListening={true}
                disabled={sending}
              />
            ) : (
              <Pressable
                onPress={handleSendPress}
                onLongPress={
                  !isEmpty && showScheduleOption
                    ? handleLongPressSend
                    : undefined
                }
                delayLongPress={400}
                disabled={sending}
                className="min-h-[50px] min-w-[50px] rounded-full bg-green-600 items-center justify-center mb-0"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  elevation: 3,
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons
                    name={sendIconName as any}
                    size={22}
                    color="#fff"
                    style={{ marginLeft: 2 }}
                  />
                )}
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Rich Text Toolbar */}
      {shouldShowToolbar && (
        <View className="flex-row items-center bg-[#F3F4F6] border-t border-b border-gray-200 py-1">
          <View className="flex-1">
            {RichToolbar && (
              <RichToolbar
                editor={richTextRef}
                actions={[
                  actions.setBold,
                  actions.setItalic,
                  actions.setUnderline,
                  actions.setStrikethrough,
                  actions.insertBulletsList,
                  actions.insertOrderedList,
                  actions.alignLeft,
                  actions.alignCenter,
                  actions.alignRight,
                ]}
                iconTint="#4B5563"
                selectedIconTint="#16a34a"
                style={{ backgroundColor: 'transparent' }}
              />
            )}
          </View>

          <ToolbarButton
            onPress={() => toggleColorPicker('text')}
            isActive={showColorPicker === 'text'}
          >
            <ColorIndicatorIcon type="text" color={currentTextColor} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => toggleColorPicker('background')}
            isActive={showColorPicker === 'background'}
          >
            <ColorIndicatorIcon type="background" color={currentBgColor} />
          </ToolbarButton>

          <TouchableOpacity
            onPress={handleCloseToolbar}
            className="px-3 py-2 border-l border-gray-300 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color="#4B5563" />
          </TouchableOpacity>
        </View>
      )}

      {showColorPicker !== null &&
        recordingMode === 'idle' &&
        !speechToTextActive && (
          <InlineColorPicker
            visible={true}
            type={showColorPicker}
            selectedColor={
              showColorPicker === 'text' ? currentTextColor : currentBgColor
            }
            onSelect={handleColorSelect}
            onClose={() => {
              setShowColorPicker(null);
              setTimeout(
                () => richTextRef.current?.focusContentEditor(),
                50
              );
            }}
          />
        )}

      {showLinkInput &&
        recordingMode === 'idle' &&
        !speechToTextActive && (
          <InlineLinkInput
            visible={true}
            onInsert={handleInsertLink}
            onClose={() => setShowLinkInput(false)}
            editorRef={richTextRef}
          />
        )}

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowScheduleModal(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-2xl px-4 pb-8 pt-4">
                <Text className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  Schedule Message
                </Text>

                {!showCustomTimePicker ? (
                  <>
                    <TouchableOpacity
                      onPress={() =>
                        handleScheduleSend(
                          new Date(
                            Date.now() + 60 * 1000
                          ).toISOString()
                        )
                      }
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">
                        Send in 1 minute (testing)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleScheduleSend(
                          new Date(
                            Date.now() + 5 * 60 * 1000
                          ).toISOString()
                        )
                      }
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">
                        Send in 5 minutes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleScheduleSend(
                          new Date(
                            Date.now() + 10 * 60 * 1000
                          ).toISOString()
                        )
                      }
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">
                        Send in 10 minutes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleScheduleSend(
                          new Date(
                            Date.now() + 30 * 60 * 1000
                          ).toISOString()
                        )
                      }
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">
                        Send in 30 minutes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleScheduleSend(
                          new Date(
                            Date.now() + 60 * 60 * 1000
                          ).toISOString()
                        )
                      }
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">
                        Send in 1 hour
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowCustomTimePicker(true)}
                      className="py-3"
                    >
                      <Text className="text-base text-green-600 font-medium">
                        Pick date & time
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View className="py-4">
                    <DateTimePicker
                      selectedDate={customScheduleDate}
                      setSelectedDate={setCustomScheduleDate}
                      selectedTime={customScheduleTime}
                      setSelectedTime={setCustomScheduleTime}
                    />
                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity
                        onPress={() => {
                          setShowCustomTimePicker(false);
                          setCustomScheduleDate(null);
                          setCustomScheduleTime(null);
                        }}
                        className="flex-1 py-3 bg-gray-200 rounded-lg items-center"
                      >
                        <Text className="text-base font-medium text-gray-700">
                          Back
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (customScheduleDate && customScheduleTime) {
                            const [h, m] = customScheduleTime
                              .split(':')
                              .map(Number);
                            const scheduled = new Date(customScheduleDate);
                            scheduled.setHours(h, m, 0, 0);
                            if (scheduled > new Date()) {
                              handleScheduleSend(scheduled.toISOString());
                            } else {
                              Alert.alert(
                                'Invalid time',
                                'Please select a future date and time.'
                              );
                            }
                          } else {
                            Alert.alert(
                              'Select time',
                              'Please select both date and time.'
                            );
                          }
                        }}
                        disabled={
                          !customScheduleDate || !customScheduleTime
                        }
                        className={`flex-1 py-3 rounded-lg items-center ${
                          !customScheduleDate || !customScheduleTime
                            ? 'bg-gray-300'
                            : 'bg-green-600'
                        }`}
                      >
                        <Text className="text-base font-medium text-white">
                          Schedule
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}