// components/chat/EditMessageModal.tsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Keyboard,
  ScrollView,
  useWindowDimensions,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/types/type';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import RenderHtml from 'react-native-render-html';
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
} from '@/components/chat/message';

// System fonts for RenderHtml
const systemFonts = Platform.select({
  ios: ['System'],
  android: ['sans-serif', 'sans-serif-medium', 'sans-serif-light'],
  default: ['System'],
});

// ---------- MESSAGE PREVIEW ----------
const MessagePreview = React.memo(({ content }: { content: string }) => {
  const { width } = useWindowDimensions();
  const contentWidth = width * 0.70;

  const cleanContent = useMemo(() => {
    if (!content) return "";
    return content.trim();
  }, [content]);

  const isHTML = isHtmlContent(cleanContent);
  
  if (!isHTML) {
    return (
      <Text className="text-base text-black" style={{ lineHeight: 22 }}>
        {cleanContent}
      </Text>
    );
  }

  return (
    <RenderHtml
      contentWidth={contentWidth}
      source={{ html: cleanContent }}
      systemFonts={systemFonts}
      baseStyle={{
        fontSize: 16,
        lineHeight: 22,
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
      }}
      tagsStyles={{
        body: { margin: 0, padding: 0 },
        p: { marginTop: 0, marginBottom: 4 },
        div: { marginTop: 0, marginBottom: 0 },
        h1: { fontSize: 28, fontWeight: '700', lineHeight: 34, marginTop: 8, marginBottom: 8 },
        h2: { fontSize: 24, fontWeight: '700', lineHeight: 30, marginTop: 6, marginBottom: 6 },
        h3: { fontSize: 20, fontWeight: '600', lineHeight: 26, marginTop: 5, marginBottom: 5 },
        h4: { fontSize: 18, fontWeight: '600', lineHeight: 24, marginTop: 4, marginBottom: 4 },
        h5: { fontSize: 16, fontWeight: '600', lineHeight: 22, marginTop: 3, marginBottom: 3 },
        h6: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 2, marginBottom: 2 },
        b: { fontWeight: '700' },
        strong: { fontWeight: '700' },
        i: { fontStyle: 'italic' },
        em: { fontStyle: 'italic' },
        a: { color: '#0088CC', textDecorationLine: 'underline' },
        ul: { paddingLeft: 20, marginTop: 4, marginBottom: 4 },
        ol: { paddingLeft: 20, marginTop: 4, marginBottom: 4 },
        li: { marginBottom: 2 },
        span: {},
      }}
      defaultTextProps={{
        textBreakStrategy: 'simple',
      }}
    />
  );
});

// ---------- MAIN COMPONENT ----------
interface EditMessageModalProps {
  visible: boolean;
  onClose: () => void;
  message: Message | null;
  roomId: string | number;
  roomMembers?: any[];
  currentUser?: {
    userId: string;
    fullName: string | null;
  } | null;
  onMessageEdited: (editedMessage: Message) => void;
}

export default function EditMessageModal({
  visible,
  onClose,
  message,
  roomId,
  onMessageEdited
}: EditMessageModalProps) {
  const { width } = useWindowDimensions();

  // Refs
  const textInputRef = useRef<TextInput>(null);
  const richTextRef = useRef<any>(null);
  const editorKeyRef = useRef(0);
  const isSwitchingRef = useRef(false);

  // State
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'background' | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [inputHeight, setInputHeight] = useState(44);
  const [formatActive, setFormatActive] = useState({ bold: false, italic: false, underline: false });
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [currentBgColor, setCurrentBgColor] = useState('#FFFFFF');

  const maxInputHeight = 150;

  // Initialize when modal opens
  useEffect(() => {
    if (message && visible) {
      const originalText = message.messageText || '';
      setEditedText(originalText);
      
      // Check if original message has HTML formatting
      const hasFormatting = isHtmlContent(originalText);
      setShowRichTextToolbar(hasFormatting);
      
      // Reset color states
      setCurrentTextColor('#000000');
      setCurrentBgColor('#FFFFFF');
      
      setTimeout(() => {
        if (hasFormatting && richTextRef.current) {
          richTextRef.current.setContentHTML(originalText);
          richTextRef.current.focusContentEditor();
        } else {
          textInputRef.current?.focus();
        }
      }, 200);
    }
  }, [message, visible]);

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

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setShowRichTextToolbar(false);
      setShowColorPicker(null);
      setShowLinkInput(false);
      setInputHeight(44);
      setFormatActive({ bold: false, italic: false, underline: false });
      setCurrentTextColor('#000000');
      setCurrentBgColor('#FFFFFF');
      editorKeyRef.current += 1;
    }
  }, [visible]);

  // Toggle rich text mode
  const handleToggleRichText = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (isSwitchingRef.current) return;

    isSwitchingRef.current = true;
    const nextState = !showRichTextToolbar;
    const shouldFocusAfter = isKeyboardVisible || isFocused;

    // Close all pickers
    setShowColorPicker(null);
    setShowLinkInput(false);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowRichTextToolbar(nextState);

    if (nextState) {
      const htmlContent = editedText ? editedText.replace(/\n/g, '<br>') : '';
      const finalHtml = htmlContent ? `<div>${htmlContent}</div>` : '';

      setTimeout(() => {
        if (richTextRef.current) {
          richTextRef.current.setContentHTML(finalHtml);
          if (shouldFocusAfter) {
            setTimeout(() => {
              richTextRef.current?.focusContentEditor();
              isSwitchingRef.current = false;
            }, 150);
          } else {
            isSwitchingRef.current = false;
          }
        } else {
          isSwitchingRef.current = false;
        }
      }, 50);
    } else {
      const plainText = stripHtml(editedText);
      setEditedText(plainText);

      setTimeout(() => {
        if (shouldFocusAfter && textInputRef.current) {
          textInputRef.current.focus();
        }
        isSwitchingRef.current = false;
      }, 100);
    }
  }, [showRichTextToolbar, editedText, isKeyboardVisible, isFocused]);

  // Color handlers
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
    if (showRichTextToolbar && richTextRef.current) {
      richTextRef.current?.insertLink(text, url);
    } else {
      setEditedText(prev => prev + ` ${url} `);
    }
  }, [showRichTextToolbar]);

  const toggleLinkInput = useCallback(() => {
    setShowColorPicker(null);
    setShowLinkInput(prev => !prev);
  }, []);

  // Format (B/I/U) toggle handlers – track active state and apply
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

  const handlePaste = useCallback((data: string) => {
    if (!data || !richTextRef.current) return;
    if (isHtmlContent(data)) {
      richTextRef.current.insertHTML(data);
    }
  }, []);

  // Focus handlers
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Computed values
  const isEmpty = useMemo(() => {
    if (showRichTextToolbar) {
      return stripHtml(editedText).length === 0;
    }
    return editedText.trim().length === 0;
  }, [editedText, showRichTextToolbar]);

  // Save handler
  const handleSave = async () => {
    if (!message) return;

    const contentToSave = showRichTextToolbar 
      ? cleanHtml(editedText) 
      : editedText.trim();

    if (!contentToSave) {
      Alert.alert('Error', 'Message text cannot be empty');
      return;
    }

    if (typeof message.id === 'string' && message.id.startsWith('temp-')) {
      Alert.alert('Error', 'Cannot edit temporary message. Please wait for the message to be sent.');
      return;
    }

    if (contentToSave === message.messageText?.trim()) {
      onClose();
      return;
    }

    try {
      setIsEditing(true);
      const token = await AuthStorage.getToken();
      
      const messageId = typeof message.id === 'string' ? message.id : String(message.id);
      const roomIdValue = String(roomId);
      
      if (!roomIdValue || roomIdValue === 'undefined' || roomIdValue === 'null') {
        throw new Error('Invalid room ID');
      }
       
      await axios.put(
        `${API_URL}/api/chat/rooms/${roomIdValue}/messages/${messageId}`,
        { messageText: contentToSave },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedMessage: Message = {
        ...message,
        messageText: contentToSave,
        isEdited: true,
        editedAt: new Date().toISOString()
      };

      onMessageEdited(updatedMessage);
      onClose();
      
    } catch (error) {
      console.error('Error editing message:', error);
      Alert.alert('Error', 'Failed to edit message. Please try again.');
    } finally {
      setIsEditing(false);
    }
  };

  // Cancel handler
  const handleCancel = () => {
    const originalText = message?.messageText || '';
    const currentText = showRichTextToolbar ? cleanHtml(editedText) : editedText.trim();
    
    if (currentText !== originalText.trim()) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose }
        ]
      );
    } else {
      onClose();
    }
  };

  if (!message || message.messageType !== 'text') {
    return null;
  }

  const shouldShowToolbar = showRichTextToolbar && Platform.OS !== 'web' && RichToolbar;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <SafeAreaView className="flex-1 bg-black/50">
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined} 
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {/* Header */}
          <View className="flex-row items-center px-2 py-3 bg-green-700">
            <TouchableOpacity onPress={handleCancel} className="p-2 mr-2">
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="flex-1 text-lg font-semibold text-white">Edit message</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Preview Area */}
          <View className="flex-1 bg-[#E5DDD5] px-4 py-3">
            <ScrollView 
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <View className="items-end">
                <Text className="text-xs text-gray-500 mb-1.5 self-start">Original message:</Text>
                <View 
                  className="max-w-[80%] bg-[#DCF8C6] rounded-xl px-3 py-2"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <MessagePreview content={message.messageText || ''} />
                  {message.isEdited && (
                    <View className="flex-row items-center justify-end mt-1">
                      <Text className="text-[11px] text-gray-400">edited</Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Input Section */}
          <View className="bg-[#E5DDD5] pb-2 px-2">
            <View className="flex-row items-end gap-2">
              {/* Format Toggle Button */}
              {Platform.OS !== 'web' && RichEditor && (
                <TouchableOpacity
                  onPress={handleToggleRichText}
                  className={`w-10 h-11 rounded-full items-center justify-center ${
                    showRichTextToolbar ? 'bg-green-100' : 'bg-gray-100'
                  }`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="text"
                    size={20}
                    color={showRichTextToolbar ? '#1DAB61' : '#666666'}
                  />
                </TouchableOpacity>
              )}

              {/* Input Container */}
              <View 
                className="flex-1 bg-white rounded-3xl overflow-hidden"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                {showRichTextToolbar && Platform.OS !== 'web' && RichEditor ? (
                  <View style={{ minHeight: 44, maxHeight: maxInputHeight }}>
                    <RichEditor
                      key={`editor-${editorKeyRef.current}`}
                      ref={richTextRef}
                      onChange={setEditedText}
                      placeholder="Message"
                      initialContentHTML=""
                      initialHeight={44}
                      androidHardwareAccelerationDisabled={true}
                      androidLayerType="software"
                      pasteAsPlainText={true}
                      onPaste={handlePaste}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      editorStyle={{
                        backgroundColor: "#ffffff",
                        placeholderColor: "#8696A0",
                        contentCSSText: `
                          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                          font-size: 17px; 
                          line-height: 22px; 
                          color: #111B21;
                          padding: 10px 14px;
                          min-height: 44px;
                          max-height: ${maxInputHeight}px;
                        `,
                      }}
                      style={{ 
                        backgroundColor: '#fff', 
                        minHeight: 44,
                        maxHeight: maxInputHeight,
                      }}
                    />
                  </View>
                ) : (
                  <TextInput
                    ref={textInputRef}
                    className="px-4 py-2.5 text-[17px] text-gray-900"
                    style={{ 
                      height: Math.min(Math.max(44, inputHeight), maxInputHeight),
                      lineHeight: 22,
                      textAlignVertical: 'center',
                    }}
                    placeholder="Message"
                    placeholderTextColor="#8696A0"
                    value={editedText}
                    onChangeText={setEditedText}
                    multiline
                    editable={!isEditing}
                    maxLength={4096}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onContentSizeChange={(event) => {
                      const contentHeight = event.nativeEvent?.contentSize?.height;
                      if (contentHeight) {
                        setInputHeight(contentHeight + 20);
                      }
                    }}
                  />
                )}
              </View>

              {/* Save Button */}
              <TouchableOpacity
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  isEditing || isEmpty ? 'bg-gray-400' : 'bg-green-600'
                }`}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={isEditing || isEmpty}
                style={{
                  shadowColor: '#1DAB61',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                {isEditing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={26} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Rich Text Toolbar */}
            <AnimatedToolbar visible={shouldShowToolbar} className="bg-white rounded-xl mt-2 overflow-hidden">
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ 
                  paddingHorizontal: 8, 
                  paddingVertical: 4,
                  alignItems: 'center',
                  paddingRight: 20,
                }}
              >
                {/* Bold */}
                <ToolbarButton onPress={handleBold} isActive={formatActive.bold}>
                  <Text className={`text-lg font-bold ${formatActive.bold ? 'text-green-600' : 'text-gray-600'}`}>B</Text>
                </ToolbarButton>
                
                {/* Italic */}
                <ToolbarButton onPress={handleItalic} isActive={formatActive.italic}>
                  <Text className={`text-lg italic ${formatActive.italic ? 'text-green-600' : 'text-gray-600'}`}>I</Text>
                </ToolbarButton>
                
                {/* Underline */}
                <ToolbarButton onPress={handleUnderline} isActive={formatActive.underline}>
                  <Text className={`text-lg ${formatActive.underline ? 'text-green-600' : 'text-gray-600'}`} style={{ textDecorationLine: 'underline' }}>U</Text>
                </ToolbarButton>
                
                {/* Strikethrough */}
                <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.setStrikethrough, 'result')}>
                  <Text className="text-lg text-gray-600" style={{ textDecorationLine: 'line-through' }}>S</Text>
                </ToolbarButton>

                <ToolbarDivider />

                {/* Text Color */}
                <ToolbarButton 
                  onPress={() => toggleColorPicker('text')} 
                  isActive={showColorPicker === 'text'}
                >
                  <ColorIndicatorIcon type="text" color={currentTextColor} />
                </ToolbarButton>

                {/* Background Color */}
                <ToolbarButton 
                  onPress={() => toggleColorPicker('background')} 
                  isActive={showColorPicker === 'background'}
                >
                  <ColorIndicatorIcon type="background" color={currentBgColor} />
                </ToolbarButton>

                <ToolbarDivider />

                {/* Link */}
                <ToolbarButton onPress={toggleLinkInput} isActive={showLinkInput}>
                  <Ionicons name="link" size={22} color={showLinkInput ? '#1DAB61' : '#666'} />
                </ToolbarButton>

                {/* Bullet List */}
                <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.insertBulletsList, 'result')}>
                  <BulletListIcon color="#666" />
                </ToolbarButton>

                {/* Number List */}
                <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.insertOrderedList, 'result')}>
                  <NumberListIcon color="#666" />
                </ToolbarButton>

                <ToolbarDivider />

                {/* Align Left */}
                <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.alignLeft, 'result')}>
                  <AlignLeftIcon color="#666" />
                </ToolbarButton>

                {/* Align Center */}
                <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.alignCenter, 'result')}>
                  <AlignCenterIcon color="#666" />
                </ToolbarButton>

                {/* Align Right */}
                <ToolbarButton onPress={() => richTextRef.current?.sendAction(actions.alignRight, 'result')}>
                  <AlignRightIcon color="#666" />
                </ToolbarButton>
              </ScrollView>
            </AnimatedToolbar>

            {/* Inline Color Picker */}
            <InlineColorPicker
              visible={showColorPicker !== null}
              type={showColorPicker}
              selectedColor={showColorPicker === 'text' ? currentTextColor : currentBgColor}
              onSelect={handleColorSelect}
              onClose={() => {
                setShowColorPicker(null);
                setTimeout(() => richTextRef.current?.focusContentEditor(), 50);
              }}
              variant="white"
            />

            {/* Inline Link Input */}
            <InlineLinkInput
              visible={showLinkInput}
              onInsert={handleInsertLink}
              onClose={() => setShowLinkInput(false)}
              editorRef={richTextRef}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}