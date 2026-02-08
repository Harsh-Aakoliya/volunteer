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
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { getReplyPreviewText } from '@/utils/messageHelpers';
import DateTimePicker from '@/components/chat/DateTimePicker';
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
  ToolbarButton,
  ToolbarDivider,
  LinkPreview,
} from '@/components/chat/message';

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
  const plainText = stripHtml(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return plainText.match(urlRegex) || [];
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
}: MessageInputProps) {

  // Refs
  const inputRef = useRef<TextInput>(null);
  const richTextRef = useRef<any>(null);
  const editorKeyRef = useRef(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const heightUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'background' | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<string[]>([]);
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [currentBgColor, setCurrentBgColor] = useState('#FFFFFF');
  
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCustomTimePicker, setShowCustomTimePicker] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState<Date | null>(null);
  const [customScheduleTime, setCustomScheduleTime] = useState<string | null>(null);

  const [formatActive, setFormatActive] = useState({ bold: false, italic: false, underline: false, strike: false });
  const [listAlignActive, setListAlignActive] = useState({
    bullet: false,
    number: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false,
  });

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

  // Format toggles
  const handleBold = useCallback(() => {
    richTextRef.current?.sendAction(actions.setBold, 'result');
    setFormatActive(prev => ({ ...prev, bold: !prev.bold }));
  }, []);
  const handleItalic = useCallback(() => {
    richTextRef.current?.sendAction(actions.setItalic, 'result');
    setFormatActive(prev => ({ ...prev, italic: !prev.italic }));
  }, []);
  const handleUnderline = useCallback(() => {
    richTextRef.current?.sendAction(actions.setUnderline, 'result');
    setFormatActive(prev => ({ ...prev, underline: !prev.underline }));
  }, []);
  const handleStrike = useCallback(() => {
    richTextRef.current?.sendAction(actions.setStrikethrough, 'result');
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
    setFormatActive({ bold: false, italic: false, underline: false, strike: false });
    setListAlignActive({
      bullet: false,
      number: false,
      alignLeft: true,
      alignCenter: false,
      alignRight: false,
    });
    setShowRichTextToolbar(false);
    setTimeout(() => {
      if (richTextRef.current) {
        richTextRef.current.setContentHTML('');
        richTextRef.current.focusContentEditor();
      } else if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  }, [onChangeText]);

  // Send handler
  const handleSendPress = useCallback(() => {
    if (isEmpty) {
      if (replyToMessage) return;
      richTextRef.current?.blurContentEditor();
      inputRef.current?.blur();
      setTimeout(() => {
        onAttachmentPress?.();
      }, 100);
      return;
    }
    const contentToSend = cleanHtml(messageText);
    onSend(contentToSend, 'text', 0, 0, 0);
    resetAfterSend();
  }, [isEmpty, replyToMessage, messageText, onSend, onAttachmentPress, resetAfterSend]);

  const handleScheduleSend = useCallback((scheduledAt: string) => {
    if (isEmpty) return;
    const contentToSend = cleanHtml(messageText);
    onSend(contentToSend, 'text', 0, 0, 0, scheduledAt);
    setShowScheduleModal(false);
    setShowCustomTimePicker(false);
    setCustomScheduleDate(null);
    setCustomScheduleTime(null);
    resetAfterSend();
  }, [isEmpty, messageText, onSend, resetAfterSend]);

  const handleLongPressSend = useCallback(() => {
    if (isEmpty) return;
    setShowScheduleModal(true);
  }, [isEmpty]);

  const maxInputHeight = (7 * 22) + 20;
  
  const shouldShowToolbar = showRichTextToolbar && Platform.OS !== 'web' && RichToolbar && recordingMode === 'idle';

  return (
    <View className="bg-[#E5DDD5] w-full pb-1">
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

      {/* Main Input Area */}
      {recordingMode !== 'idle' && onSendAudio ? (
        // ... Recording View (unchanged) ...
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
              className="w-10 h-10 rounded-full bg-green-600 items-center justify-center min-h-[40px]"
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
        // ... Normal Input View ...
        <View className="px-2 pt-1">
          {/* Container Row: White Bubble + Send Button */}
          <View className="flex-row items-end">
            
            {/* White Bubble: Contains Reply & Input */}
            <View className="flex-1 bg-white rounded-[22px] border border-gray-200 overflow-hidden mr-2 min-h-[44px]">
              
              {/* Reply Preview Section - Inside the bubble */}
              {replyToMessage && (
                <View className="mt-2 mx-2 mb-1 p-2 bg-gray-100 rounded-lg border-l-[4px] border-green-600 flex-row items-start justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-green-600 text-xs font-bold mb-0.5">
                      {replyToMessage.senderId === currentUser?.userId ? 'You' : replyToMessage.senderName}
                    </Text>
                    <Text className="text-gray-600 text-xs" numberOfLines={2} ellipsizeMode="tail">
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

              {/* Text Input Row - Inside the bubble, below reply */}
              <View 
                className="flex-row items-center px-1 pb-1" 
                style={{ maxHeight: maxInputHeight }}
              >
                <View className="flex-1 justify-center" style={{ paddingVertical: 2, paddingLeft: 6 }}>
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
                          overflow-y: auto;
                          overflow-x: hidden;
                          scrollbar-width: none;
                          -ms-overflow-style: none;
                          -webkit-overflow-scrolling: touch;
                        `,
                      }}
                      style={{ backgroundColor: 'transparent', minHeight: 36, maxHeight: maxInputHeight - 20 }}
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
                        const contentHeight = event.nativeEvent?.contentSize?.height;
                        if (!contentHeight) return;
                        if (heightUpdateTimeoutRef.current) clearTimeout(heightUpdateTimeoutRef.current);
                        heightUpdateTimeoutRef.current = setTimeout(() => {
                          const newHeight = Math.min(Math.max(40, Math.ceil(contentHeight)), maxInputHeight);
                          if (Math.abs(newHeight - inputHeight) >= 2) setInputHeight(newHeight);
                        }, 50);
                      }}
                      scrollEnabled={inputHeight >= maxInputHeight - 20}
                    />
                  )}
                </View>

                {/* Inner Action Buttons: initially Attachment + Aa; when typing, only Aa */}
                <View className="flex-row items-center justify-end pr-1">
                  {!showRichTextToolbar && Platform.OS !== 'web' && (
                    <>
                      {isEmpty && (
                        <TouchableOpacity onPress={onAttachmentPress} className="p-1">
                          <Ionicons name="attach" size={24} color="#4B5563" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setShowRichTextToolbar(true);
                          setTimeout(() => richTextRef.current?.focusContentEditor(), 100);
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
            <Pressable
              onPress={isEmpty ? (onSendAudio ? handleStartRecording : onAttachmentPress) : handleSendPress}
              onLongPress={!isEmpty ? handleLongPressSend : undefined}
              delayLongPress={400}
              disabled={sending}
              className="min-h-[50px] min-w-[50px] rounded-full bg-green-600 items-center justify-center mb-0"
              style={{ 
                shadowColor: '#000', 
                shadowOffset: { width: 0, height: 1 }, 
                shadowOpacity: 0.2, 
                shadowRadius: 3, 
                elevation: 3 
              }}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : isEmpty ? (
                onSendAudio ? (
                  <Ionicons name="mic" size={24} color="#fff" />
                ) : (
                  <Ionicons name="mic" size={24} color="#fff" />
                )
              ) : (
                <Ionicons name="send" size={22} color="#fff" style={{ marginLeft: 2 }} />
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Rich Text Toolbar (unchanged) */}
      {shouldShowToolbar && (
        <View className="flex-row items-center bg-[#F3F4F6] border-t border-b border-gray-200 py-1">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'center' }}
            className="flex-1"
          >
            <ToolbarButton onPress={handleBold} isActive={formatActive.bold}>
              <Text className={`text-lg font-bold ${formatActive.bold ? 'text-green-600' : 'text-gray-700'}`}>B</Text>
            </ToolbarButton>
             {/* ... (rest of toolbar buttons) ... */}
            <ToolbarButton onPress={handleItalic} isActive={formatActive.italic}>
              <Text className={`text-lg italic ${formatActive.italic ? 'text-green-600' : 'text-gray-700'}`}>I</Text>
            </ToolbarButton>
            <ToolbarButton onPress={handleUnderline} isActive={formatActive.underline}>
              <Text className={`text-lg ${formatActive.underline ? 'text-green-600' : 'text-gray-700'}`} style={{ textDecorationLine: 'underline' }}>U</Text>
            </ToolbarButton>
            <ToolbarButton onPress={handleStrike} isActive={formatActive.strike}>
              <Text className={`text-lg ${formatActive.strike ? 'text-green-600' : 'text-gray-700'}`} style={{ textDecorationLine: 'line-through' }}>S</Text>
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton onPress={() => toggleColorPicker('text')} isActive={showColorPicker === 'text'}>
              <ColorIndicatorIcon type="text" color={currentTextColor} />
            </ToolbarButton>
            <ToolbarButton onPress={() => toggleColorPicker('background')} isActive={showColorPicker === 'background'}>
              <ColorIndicatorIcon type="background" color={currentBgColor} />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton onPress={toggleLinkInput} isActive={showLinkInput}>
              <Ionicons name="link" size={22} color={showLinkInput ? '#1DAB61' : '#4B5563'} />
            </ToolbarButton>
            <ToolbarButton onPress={handleBulletList} isActive={listAlignActive.bullet}>
              <BulletListIcon color={listAlignActive.bullet ? '#16a34a' : '#4B5563'} />
            </ToolbarButton>
            <ToolbarButton onPress={handleNumberList} isActive={listAlignActive.number}>
              <NumberListIcon color={listAlignActive.number ? '#16a34a' : '#4B5563'} />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton onPress={handleAlignLeft} isActive={listAlignActive.alignLeft}>
              <AlignLeftIcon color={listAlignActive.alignLeft ? '#16a34a' : '#4B5563'} />
            </ToolbarButton>
            <ToolbarButton onPress={handleAlignCenter} isActive={listAlignActive.alignCenter}>
              <AlignCenterIcon color={listAlignActive.alignCenter ? '#16a34a' : '#4B5563'} />
            </ToolbarButton>
            <ToolbarButton onPress={handleAlignRight} isActive={listAlignActive.alignRight}>
              <AlignRightIcon color={listAlignActive.alignRight ? '#16a34a' : '#4B5563'} />
            </ToolbarButton>
          </ScrollView>

          <TouchableOpacity
            onPress={handleCloseToolbar}
            className="px-3 py-2 border-l border-gray-300 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color="#4B5563" />
          </TouchableOpacity>
        </View>
      )}

      {/* Inline Color Picker & Link Input & Modal (unchanged) */}
      {showColorPicker !== null && recordingMode === 'idle' && (
        <InlineColorPicker
          visible={true}
          type={showColorPicker}
          selectedColor={showColorPicker === 'text' ? currentTextColor : currentBgColor}
          onSelect={handleColorSelect}
          onClose={() => {
            setShowColorPicker(null);
            setTimeout(() => richTextRef.current?.focusContentEditor(), 50);
          }}
        />
      )}

      {showLinkInput && recordingMode === 'idle' && (
        <InlineLinkInput
          visible={true}
          onInsert={handleInsertLink}
          onClose={() => setShowLinkInput(false)}
          editorRef={richTextRef}
        />
      )}

      <Modal
        visible={showScheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowScheduleModal(false)}>
          <View className="flex-1 justify-end bg-black/40">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-2xl px-4 pb-8 pt-4">
                <Text className="text-lg font-semibold text-gray-900 mb-4 text-center">Schedule Message</Text>

                {!showCustomTimePicker ? (
                  <>
                    <TouchableOpacity
                      onPress={() => handleScheduleSend(new Date(Date.now() + 10 * 1000).toISOString())}
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">Send in 10 seconds (testing)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleScheduleSend(new Date(Date.now() + 5 * 60 * 1000).toISOString())}
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">Send in 5 minutes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleScheduleSend(new Date(Date.now() + 10 * 60 * 1000).toISOString())}
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">Send in 10 minutes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleScheduleSend(new Date(Date.now() + 30 * 60 * 1000).toISOString())}
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">Send in 30 minutes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleScheduleSend(new Date(Date.now() + 60 * 60 * 1000).toISOString())}
                      className="py-3 border-b border-gray-100"
                    >
                      <Text className="text-base text-gray-900">Send in 1 hour</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowCustomTimePicker(true)}
                      className="py-3"
                    >
                      <Text className="text-base text-green-600 font-medium">Pick date & time</Text>
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
                        <Text className="text-base font-medium text-gray-700">Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (customScheduleDate && customScheduleTime) {
                            const [h, m] = customScheduleTime.split(':').map(Number);
                            const scheduled = new Date(customScheduleDate);
                            scheduled.setHours(h, m, 0, 0);
                            if (scheduled > new Date()) {
                              handleScheduleSend(scheduled.toISOString());
                            } else {
                              Alert.alert('Invalid time', 'Please select a future date and time.');
                            }
                          } else {
                            Alert.alert('Select time', 'Please select both date and time.');
                          }
                        }}
                        disabled={!customScheduleDate || !customScheduleTime}
                        className={`flex-1 py-3 rounded-lg items-center ${!customScheduleDate || !customScheduleTime ? 'bg-gray-300' : 'bg-green-600'}`}
                      >
                        <Text className="text-base font-medium text-white">Schedule</Text>
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