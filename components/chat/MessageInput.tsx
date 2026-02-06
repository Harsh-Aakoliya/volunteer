// components/chat/MessageInput.tsx

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Keyboard,
  ScrollView,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { getReplyPreviewText } from '@/utils/messageHelpers';
import {
  RichEditor,
  RichToolbar,
  actions,
  cleanHtml,
  stripHtml,
  isHtmlContent,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  BulletListIcon,
  NumberListIcon,
  ColorIndicatorIcon,
  InlineColorPicker,
  InlineLinkInput,
  AnimatedToolbar,
  ToolbarButton,
  ToolbarDivider,
  LinkPreview,
} from '@/components/chat/message';
import { FormatEditText, type FormatEditTextRef } from '@/components/chat/FormatEditText';

// ---------- TYPES ----------
interface MessageInputProps {
  messageText: string;
  onChangeText: (text: string) => void;
  onSend: (text: string, messageType: string, mediafilesId: number, tableId: number, pollId: number, scheduledAt?: string) => void;
  placeholder?: string;
  sending?: boolean;
  disabled?: boolean;
  currentUser?: { userId: string; fullName: string | null; } | null;
  replyToMessage?: any | null;
  onCancelReply?: () => void;
  onAttachmentPress?: () => void;
  isAttachmentSheetOpen?: boolean;
  onSendAudio?: (audioUri: string) => void | Promise<void>;
}

// ---------- HELPER (link detection for preview) ----------
const extractLinks = (text: string): string[] => {
  // Strip HTML first so we don't extract raw href attributes
  const plainText = stripHtml(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return plainText.match(urlRegex) || [];
};

/*
 * Context Menu Formatting:
 * - Android: Uses native FormatEditText with "Format" in the system Cut/Copy/Paste menu;
 *   tapping Format opens the formatting toolbar (B/I/U etc.).
 * - iOS/Web: RichEditor (WebView) cannot add to the system menu; we show a floating
 *   "Format" button above the input when there is text and the keyboard is visible.
 */

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
}: MessageInputProps) {

  // Refs
  const inputRef = useRef<TextInput>(null);
  const richTextRef = useRef<any>(null);
  const formatEditTextRef = useRef<FormatEditTextRef>(null);
  const editorKeyRef = useRef(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  // State
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'background' | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<string[]>([]);
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [currentBgColor, setCurrentBgColor] = useState('#FFFFFF');
  
  const [formatActive, setFormatActive] = useState({ bold: false, italic: false, underline: false, strike: false });
  const [listAlignActive, setListAlignActive] = useState({
    bullet: false,
    number: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false,
  });
  const heightUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track text selection for showing Format button (Gmail-style)
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const selectionCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio recording state
  const [recordingMode, setRecordingMode] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);

  // Audio permissions and mode
  useEffect(() => {
    if (!onSendAudio || Platform.OS === 'web') return;
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
  }, [onSendAudio]);

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = useCallback(async () => {
    if (!onSendAudio) return;
    try {
      setShowRichTextToolbar(false);
      setShowColorPicker(null);
      setShowLinkInput(false);
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setRecordingMode('recording');
      setRecordingDuration(0);
      setRecordedUri(null);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      Alert.alert('Recording', 'Could not start recording. Please allow microphone access.');
    }
  }, [onSendAudio]);

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
  }, [onSendAudio, recordedUri]);

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
          if ((s as any).didJustFinishAndNotJustLooped ?? (s as any).didJustFinish) {
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

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });

    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardShowListener?.remove();
      keyboardHideListener?.remove();
    };
  }, []);

  // When replying, focus input after short delay
  useEffect(() => {
    if (!replyToMessage || recordingMode !== 'idle') return;
    const t = setTimeout(() => {
      richTextRef.current?.focusContentEditor?.();
    }, 100);
    return () => clearTimeout(t);
  }, [replyToMessage, recordingMode]);

  // Computed values - must be declared before useEffects that use them
  const isEmpty = useMemo(() => {
    return stripHtml(messageText).trim().length === 0;
  }, [messageText]);
  
  // Check if there's any text content (for showing Format button)
  const hasText = useMemo(() => {
    return stripHtml(messageText).trim().length > 0;
  }, [messageText]);

  // Show Format button when there's text and keyboard is visible (Gmail-style)
  // Note: We can't inject into native Android context menu, so we show Format button
  // above the input when user can format text (has text + keyboard visible)
  useEffect(() => {
    if (Platform.OS === 'web' || recordingMode !== 'idle') {
      setHasTextSelection(false);
      return;
    }
    
    // Show Format option when there's text content and keyboard is visible
    // This approximates Gmail's behavior - Format appears when you can format text
    const shouldShowFormat = hasText && isKeyboardVisible && !showRichTextToolbar;
    setHasTextSelection(shouldShowFormat);
  }, [hasText, isKeyboardVisible, showRichTextToolbar, recordingMode]);

  // Link detection
  useEffect(() => {
    const links = extractLinks(messageText);
    setLinkPreviews(links);
  }, [messageText]);

  // Color picker handlers
  const handleColorSelect = useCallback((color: string) => {
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
  }, [showColorPicker]);

  const toggleColorPicker = useCallback((type: 'text' | 'background') => {
    setShowLinkInput(false);
    setShowColorPicker(prev => prev === type ? null : type);
  }, []);

  // Link handlers
  const handleInsertLink = useCallback((url: string, text: string) => {
    if (richTextRef.current) {
      richTextRef.current?.insertLink(text, url);
    } else {
      onChangeText(messageText + ` ${url} `);
    }
  }, [messageText, onChangeText]);

  const toggleLinkInput = useCallback(() => {
    setShowColorPicker(null);
    setShowLinkInput(prev => !prev);
  }, []);

  // Format (B/I/U) toggle – track active state
  const handleBold = useCallback(() => {
    if (Platform.OS === 'android' && formatEditTextRef.current) {
      formatEditTextRef.current.setBold();
    } else {
      richTextRef.current?.sendAction(actions.setBold, 'result');
    }
    setFormatActive(prev => ({ ...prev, bold: !prev.bold }));
  }, []);
  const handleItalic = useCallback(() => {
    if (Platform.OS === 'android' && formatEditTextRef.current) {
      formatEditTextRef.current.setItalic();
    } else {
      richTextRef.current?.sendAction(actions.setItalic, 'result');
    }
    setFormatActive(prev => ({ ...prev, italic: !prev.italic }));
  }, []);
  const handleUnderline = useCallback(() => {
    if (Platform.OS === 'android' && formatEditTextRef.current) {
      formatEditTextRef.current.setUnderline();
    } else {
      richTextRef.current?.sendAction(actions.setUnderline, 'result');
    }
    setFormatActive(prev => ({ ...prev, underline: !prev.underline }));
  }, []);
  const handleStrike = useCallback(() => {
    richTextRef.current?.sendAction(actions.setStrikeThrough, 'result');
    setFormatActive(prev => ({ ...prev, strike: !prev.strike }));
  }, []);

  // List & alignment
  const handleBulletList = useCallback(() => {
    richTextRef.current?.sendAction(actions.insertBulletsList, 'result');
    setListAlignActive(prev => ({ ...prev, bullet: !prev.bullet, number: false }));
  }, []);
  const handleNumberList = useCallback(() => {
    richTextRef.current?.sendAction(actions.insertOrderedList, 'result');
    setListAlignActive(prev => ({ ...prev, number: !prev.number, bullet: false }));
  }, []);
  const handleAlignLeft = useCallback(() => {
    richTextRef.current?.sendAction(actions.alignLeft, 'result');
    setListAlignActive(prev => ({ ...prev, alignLeft: true, alignCenter: false, alignRight: false }));
  }, []);
  const handleAlignCenter = useCallback(() => {
    richTextRef.current?.sendAction(actions.alignCenter, 'result');
    setListAlignActive(prev => ({ ...prev, alignLeft: false, alignCenter: true, alignRight: false }));
  }, []);
  const handleAlignRight = useCallback(() => {
    richTextRef.current?.sendAction(actions.alignRight, 'result');
    setListAlignActive(prev => ({ ...prev, alignLeft: false, alignCenter: false, alignRight: true }));
  }, []);

  const handlePaste = useCallback((data: string) => {
    if (!data || !richTextRef.current) return;
    if (isHtmlContent(data)) {
      richTextRef.current.insertHTML(data);
    }
  }, []);

  const handleRemoveLinkPreview = useCallback((url: string) => {
    const newText = messageText.replace(url, '').trim();
    onChangeText(newText);
  }, [messageText, onChangeText]);

  // Send handler
  const handleSendPress = useCallback(() => {
    if (isEmpty) {
      if (replyToMessage) return;

      Keyboard.dismiss();
      richTextRef.current?.blurContentEditor();
      inputRef.current?.blur();

      setTimeout(() => {
        onAttachmentPress?.();
      }, 100);
      return;
    }

    const contentToSend = cleanHtml(messageText);

    onSend(contentToSend, 'text', 0, 0, 0);

    // Reset everything
    onChangeText('');
    setInputHeight(40);
    setLinkPreviews([]);
    setShowColorPicker(null);
    setShowLinkInput(false);
    setCurrentTextColor('#000000');
    setCurrentBgColor('#FFFFFF');
    setShowRichTextToolbar(false);
    setFormatActive({ bold: false, italic: false, underline: false, strike: false });
    setListAlignActive({ bullet: false, number: false, alignLeft: true, alignCenter: false, alignRight: false });

    // Force editor reset 
    editorKeyRef.current += 1;
    setTimeout(() => {
      if (richTextRef.current) {
        richTextRef.current.setContentHTML('');
        richTextRef.current.blurContentEditor();
      }
    }, 50);
  }, [isEmpty, replyToMessage, messageText, onSend, onChangeText, onAttachmentPress]);

  const maxInputHeight = (7 * 22) + 20;
  // Toolbar visibility conditions
  const shouldShowToolbar = showRichTextToolbar && Platform.OS !== 'web' && RichToolbar && recordingMode === 'idle';

  return (
    <View className="bg-white w-full">
      {/* Link Previews */}
      {linkPreviews.length > 0 && (
        <View className="px-3 pt-2 pb-1">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
            {linkPreviews.map((url, index) => (
              <LinkPreview key={index} url={url} onRemove={() => handleRemoveLinkPreview(url)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main Input Row – or Recording UI when active */}
      {recordingMode !== 'idle' && onSendAudio ? (
        <View className="px-3 py-2 bg-white">
          <View className="flex-row items-center mb-3">
            {recordingMode === 'recording' ? (
              <>
                <Text className="text-base font-semibold text-gray-900 mr-2">{formatRecordingTime(recordingDuration)}</Text>
                <Text className="text-sm text-gray-500">Recording...</Text>
              </>
            ) : recordedUri ? (
              <>
                <TouchableOpacity
                  onPress={previewPlaying ? handlePausePreview : handlePlayPreview}
                  className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-2"
                >
                  <Ionicons name={previewPlaying ? 'pause' : 'play'} size={22} color="#374151" />
                </TouchableOpacity>
                <View className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden mx-2">
                  <View
                    className="h-full bg-green-600 rounded-full"
                    style={{ width: `${previewDuration > 0 ? (previewPosition / previewDuration) * 100 : 0}%` }}
                  />
                </View>
                <Text className="text-base font-semibold text-gray-900 ml-0" style={{ minWidth: 36 }}>
                  {previewPlaying
                    ? formatRecordingTime(Math.floor(previewPosition))
                    : formatRecordingTime(previewDuration > 0 ? Math.floor(previewDuration) : recordingDuration)}
                </Text>
              </>
            ) : (
              <>
                <Text className="text-base font-semibold text-gray-900 mr-2">{formatRecordingTime(recordingDuration)}</Text>
                <Text className="text-sm text-gray-500">Paused</Text>
              </>
            )}
          </View>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={handleDeleteRecording} className="p-2">
              <Ionicons name="trash-outline" size={24} color="#6b7280" />
            </TouchableOpacity>
            {recordingMode === 'recording' ? (
              <TouchableOpacity onPress={handlePauseRecording} className="p-2">
                <Ionicons name="pause" size={28} color="#dc2626" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleResumeRecording} className="p-2">
                <Ionicons name="mic" size={28} color="#dc2626" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSendAudio}
              disabled={sendingAudio}
              className="w-11 h-11 rounded-full bg-green-600 items-center justify-center"
              style={{ shadowColor: '#1DAB61', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }}
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
        <View className="px-3 py-2">
          {/* Reply preview bar */}
          {replyToMessage ? (
            <View className="flex-row items-center mb-2 px-2 py-2 bg-green-100 rounded-xl border-l-[3px] border-green-600">
              <View className="flex-1 mr-1">
                <Text className="text-green-600 text-xs font-bold">
                  {replyToMessage.senderId === currentUser?.userId ? 'You' : replyToMessage.senderName}
                </Text>
                <Text className="text-gray-600 text-xs" numberOfLines={2} ellipsizeMode="tail">
                  {getReplyPreviewText(replyToMessage)}
                </Text>
              </View>
              <TouchableOpacity onPress={onCancelReply} className="p-2">
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Main Input Row */}
          <View className="flex-row items-end" style={{ alignItems: 'center' }}>
            <View
              className="flex-1 flex-row items-end bg-white rounded-3xl border border-gray-300 min-h-[40px] px-2 mr-2"
              style={{ maxHeight: maxInputHeight }}
            >
              <View className="flex-1 min-h-[40px] justify-center" style={{ paddingVertical: 6 }}>
                {/* Android: native FormatEditText for Cut/Copy/Paste/Format context menu */}
                {Platform.OS === 'android' && FormatEditText ? (
                  <FormatEditText
                    ref={formatEditTextRef}
                    value={stripHtml(messageText)}
                    placeholder={placeholder}
                    onChangeText={onChangeText}
                    onFormat={() => setShowRichTextToolbar(true)}
                    style={{
                      backgroundColor: 'transparent',
                      minHeight: 36,
                      maxHeight: maxInputHeight - 8,
                      padding: 0,
                      fontSize: 16,
                      color: '#1F2937',
                    }}
                  />
                ) : Platform.OS !== 'web' && RichEditor ? (
                  <RichEditor
                    key={`editor-${editorKeyRef.current}`}
                    ref={richTextRef}
                    onChange={onChangeText}
                    placeholder={placeholder}
                    initialContentHTML=""
                    initialHeight={40}
                    androidHardwareAccelerationDisabled={true}
                    androidLayerType="software"
                    pasteAsPlainText={true}
                    onPaste={handlePaste}
                    editorStyle={{
                      backgroundColor: 'transparent',
                      placeholderColor: '#9CA3AF',
                      contentCSSText: `
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        font-size: 16px;
                        line-height: 22px;
                        color: #1F2937;
                        padding: 0 4px 2px 4px;
                        min-height: 36px;
                        max-height: ${maxInputHeight - 8}px;
                      `,
                    }}
                    style={{ backgroundColor: 'transparent', minHeight: 36, maxHeight: maxInputHeight - 8 }}
                  />
                ) : (
                  <TextInput
                    ref={inputRef}
                    value={messageText}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    className="px-2 py-1 text-base text-gray-800"
                    style={{
                      minHeight: 36,
                      height: inputHeight,
                      maxHeight: maxInputHeight - 8,
                      lineHeight: 22,
                      textAlignVertical: 'center',
                      paddingVertical: 8,
                    }}
                    onContentSizeChange={(event) => {
                      const contentHeight = event.nativeEvent?.contentSize?.height;
                      if (!contentHeight) return;
                      if (heightUpdateTimeoutRef.current) clearTimeout(heightUpdateTimeoutRef.current);
                      heightUpdateTimeoutRef.current = setTimeout(() => {
                        const newHeight = Math.min(Math.max(40, Math.ceil(contentHeight)), maxInputHeight);
                        if (Math.abs(newHeight - inputHeight) >= 2) setInputHeight(newHeight);
                      }, 50);
                    }}
                    scrollEnabled={inputHeight >= maxInputHeight}
                  />
                )}
              </View>

              {/* Action Buttons inside Input Pill */}
              <View className="flex-row items-center mb-[2px]">
                {/* Attachment Button - Hides when typing */}
                {isEmpty && (
                  <TouchableOpacity
                    onPress={onAttachmentPress}
                    className="p-1.5 ml-1"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="attach" size={22} color="#6B7280" />
                  </TouchableOpacity>
                )}
                {/* Camera Button - Hides when typing */}
                {isEmpty && (
                  <TouchableOpacity
                    onPress={onAttachmentPress}
                    className="p-1.5 ml-1"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="camera-outline" size={22} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Right: Green Send / Mic button */}
            <TouchableOpacity
              onPress={isEmpty ? (onSendAudio ? handleStartRecording : onAttachmentPress) : handleSendPress}
              disabled={sending}
              className="w-11 h-11 rounded-full bg-green-600 items-center justify-center"
              style={{ shadowColor: '#1DAB61', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : isEmpty ? (
                onSendAudio ? (
                  <Ionicons name="mic" size={22} color="#fff" />
                ) : (
                  <Ionicons name="add" size={26} color="#fff" />
                )
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Format Button - Gmail-style (iOS/web only; Android uses native context menu) */}
      {hasTextSelection && Platform.OS !== 'web' && Platform.OS !== 'android' && !showRichTextToolbar && recordingMode === 'idle' && (
        <View 
          className="px-3 pb-2 bg-white"
          style={{ zIndex: 1000 }}
        >
          <View className="flex-row justify-center">
            <TouchableOpacity
              onPress={() => {
                setShowRichTextToolbar(true);
                setTimeout(() => richTextRef.current?.focusContentEditor(), 100);
              }}
              className="bg-[#1F2937] rounded-lg px-4 py-2.5 flex-row items-center"
              activeOpacity={0.8}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <Ionicons name="text" size={18} color="#FFFFFF" />
              <Text className="text-white text-sm font-medium ml-2">Format</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Enhanced Rich Text Toolbar (WhatsApp/Gmail Design) */}
      <AnimatedToolbar visible={shouldShowToolbar}>
        <View className="flex-row items-center bg-white border-t border-gray-200" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: -1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 4 }}
            className="flex-1"
          >
            {/* Bold */}
            <ToolbarButton onPress={handleBold} isActive={formatActive.bold}>
              <Text className={`text-base font-bold ${formatActive.bold ? 'text-[#0088CC]' : 'text-[#54656F]'}`}>B</Text>
            </ToolbarButton>

            {/* Italic */}
            <ToolbarButton onPress={handleItalic} isActive={formatActive.italic}>
              <Text className={`text-base italic ${formatActive.italic ? 'text-[#0088CC]' : 'text-[#54656F]'}`}>I</Text>
            </ToolbarButton>

            {/* Underline */}
            <ToolbarButton onPress={handleUnderline} isActive={formatActive.underline}>
              <Text className={`text-base ${formatActive.underline ? 'text-[#0088CC]' : 'text-[#54656F]'}`} style={{ textDecorationLine: 'underline' }}>U</Text>
            </ToolbarButton>

            {/* Strikethrough */}
            <ToolbarButton onPress={handleStrike} isActive={formatActive.strike}>
              <Text className={`text-base ${formatActive.strike ? 'text-[#0088CC]' : 'text-[#54656F]'}`} style={{ textDecorationLine: 'line-through' }}>S</Text>
            </ToolbarButton>

            <View className="w-px h-6 bg-gray-300 mx-1" />

            {/* Text Color */}
            <ToolbarButton onPress={() => toggleColorPicker('text')} isActive={showColorPicker === 'text'}>
              <ColorIndicatorIcon type="text" color={currentTextColor} />
            </ToolbarButton>

            {/* Background Color */}
            <ToolbarButton onPress={() => toggleColorPicker('background')} isActive={showColorPicker === 'background'}>
              <ColorIndicatorIcon type="background" color={currentBgColor} />
            </ToolbarButton>

            <View className="w-px h-6 bg-gray-300 mx-1" />

            {/* Link */}
            <ToolbarButton onPress={toggleLinkInput} isActive={showLinkInput}>
              <Ionicons name="link" size={20} color={showLinkInput ? '#0088CC' : '#54656F'} />
            </ToolbarButton>

            {/* Bullet List */}
            <ToolbarButton onPress={handleBulletList} isActive={listAlignActive.bullet}>
              <BulletListIcon color={listAlignActive.bullet ? '#0088CC' : '#54656F'} />
            </ToolbarButton>

            {/* Number List */}
            <ToolbarButton onPress={handleNumberList} isActive={listAlignActive.number}>
              <NumberListIcon color={listAlignActive.number ? '#0088CC' : '#54656F'} />
            </ToolbarButton>

            <View className="w-px h-6 bg-gray-300 mx-1" />

            {/* Align Left */}
            <ToolbarButton onPress={handleAlignLeft} isActive={listAlignActive.alignLeft}>
              <AlignLeftIcon color={listAlignActive.alignLeft ? '#0088CC' : '#54656F'} />
            </ToolbarButton>

            {/* Align Center */}
            <ToolbarButton onPress={handleAlignCenter} isActive={listAlignActive.alignCenter}>
              <AlignCenterIcon color={listAlignActive.alignCenter ? '#0088CC' : '#54656F'} />
            </ToolbarButton>

            {/* Align Right */}
            <ToolbarButton onPress={handleAlignRight} isActive={listAlignActive.alignRight}>
              <AlignRightIcon color={listAlignActive.alignRight ? '#0088CC' : '#54656F'} />
            </ToolbarButton>
          </ScrollView>

          {/* Close Toolbar Button (X icon) - WhatsApp style */}
          <TouchableOpacity
            onPress={() => {
              setShowRichTextToolbar(false);
              setShowColorPicker(null);
              setShowLinkInput(false);
            }}
            className="px-4 py-2 items-center justify-center border-l border-gray-200"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color="#54656F" />
          </TouchableOpacity>
        </View>
      </AnimatedToolbar>

      {/* Inline Color Picker */}
      <InlineColorPicker
        visible={showColorPicker !== null && recordingMode === 'idle'}
        type={showColorPicker}
        selectedColor={showColorPicker === 'text' ? currentTextColor : currentBgColor}
        onSelect={handleColorSelect}
        onClose={() => {
          setShowColorPicker(null);
          setTimeout(() => richTextRef.current?.focusContentEditor(), 50);
        }}
      />

      {/* Inline Link Input */}
      <InlineLinkInput
        visible={showLinkInput && recordingMode === 'idle'}
        onInsert={handleInsertLink}
        onClose={() => setShowLinkInput(false)}
        editorRef={richTextRef}
      />
    </View>
  );
}