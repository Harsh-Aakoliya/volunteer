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
  Animated,
  Easing,
  ScrollView,
  LayoutAnimation,
} from 'react-native';
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

// ---------- TYPES ----------
interface MessageInputProps {
  messageText: string;
  onChangeText: (text: string) => void;
  onSend: (text: string, messageType: string, mediafilesId: number, tableId: number, pollId: number, scheduledAt?: string) => void;
  placeholder?: string;
  sending?: boolean;
  disabled?: boolean;
  currentUser?: { userId: string; fullName: string | null; } | null;
  onFocus?: () => void;
  onBlur?: () => void;
  replyToMessage?: any | null;
  onCancelReply?: () => void;
  onAttachmentPress?: () => void;
  isAttachmentSheetOpen?: boolean;
}

// ---------- HELPER (link detection for preview) ----------
const extractLinks = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

// ---------- MAIN COMPONENT ----------
export default function MessageInput({
  messageText,
  onChangeText,
  onSend,
  placeholder = 'Message',
  sending = false,
  currentUser,
  onFocus,
  onBlur,
  replyToMessage,
  onCancelReply,
  onAttachmentPress,
  isAttachmentSheetOpen = false,
}: MessageInputProps) {

  // Refs
  const inputRef = useRef<TextInput>(null);
  const richTextRef = useRef<any>(null);
  const plusAnim = useRef(new Animated.Value(0)).current;
  const isSwitchingRef = useRef(false);
  const editorKeyRef = useRef(0);

  // State
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'background' | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<string[]>([]);
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [currentBgColor, setCurrentBgColor] = useState('#FFFFFF');
  const [formatActive, setFormatActive] = useState({ bold: false, italic: false, underline: false });
  const heightUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation for plus button
  useEffect(() => {
    Animated.timing(plusAnim, {
      toValue: isAttachmentSheetOpen ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isAttachmentSheetOpen]);

  const plusRotate = plusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

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

  // Link detection
  useEffect(() => {
    const links = extractLinks(messageText);
    setLinkPreviews(links);
  }, [messageText]);

  // Toggle rich text mode
  const handleToggleRichText = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (isSwitchingRef.current) return;

    isSwitchingRef.current = true;
    const nextState = !showRichTextToolbar;
    const shouldFocusAfter = isKeyboardVisible || isFocused;

    setShowColorPicker(null);
    setShowLinkInput(false);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowRichTextToolbar(nextState);

    if (nextState) {
      const htmlContent = messageText ? messageText.replace(/\n/g, '<br>') : '';
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
      const plainText = stripHtml(messageText);
      onChangeText(plainText);

      setTimeout(() => {
        if (shouldFocusAfter && inputRef.current) {
          inputRef.current.focus();
        }
        isSwitchingRef.current = false;
      }, 100);
    }
  }, [showRichTextToolbar, messageText, onChangeText, isKeyboardVisible, isFocused]);

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
    if (showRichTextToolbar && richTextRef.current) {
      richTextRef.current?.insertLink(text, url);
    } else {
      onChangeText(messageText + ` ${url} `);
    }
  }, [showRichTextToolbar, messageText, onChangeText]);

  const toggleLinkInput = useCallback(() => {
    setShowColorPicker(null);
    setShowLinkInput(prev => !prev);
  }, []);

  // Format (B/I/U) toggle – track active state
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

  // Paste: when pasted content is HTML, editor does not insert it (library patch); we insert rendered HTML only
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
    if (showRichTextToolbar) {
      return stripHtml(messageText).length === 0;
    }
    return messageText.trim().length === 0;
  }, [messageText, showRichTextToolbar]);

  // Send handler
  const handleSendPress = useCallback(() => {
    if (isEmpty) {
      if (replyToMessage) return;

      Keyboard.dismiss();
      if (showRichTextToolbar) {
        richTextRef.current?.blurContentEditor();
      } else {
        inputRef.current?.blur();
      }

      setTimeout(() => {
        onAttachmentPress?.();
      }, 100);
      return;
    }
    
    const contentToSend = showRichTextToolbar
      ? cleanHtml(messageText)
      : messageText.trim();

    onSend(contentToSend, 'text', 0, 0, 0);

    // Reset everything
    onChangeText('');
    setInputHeight(40);
    setLinkPreviews([]);
    setShowColorPicker(null);
    setShowLinkInput(false);
    setCurrentTextColor('#000000');
    setCurrentBgColor('#FFFFFF');

    if (showRichTextToolbar) {
      // Force editor reset by incrementing key
      editorKeyRef.current += 1;
      setShowRichTextToolbar(false);
      
      // Clear editor content
      setTimeout(() => {
        if (richTextRef.current) {
          richTextRef.current.setContentHTML('');
          richTextRef.current.blurContentEditor();
        }
      }, 50);
    }
  }, [isEmpty, replyToMessage, showRichTextToolbar, messageText, onSend, onChangeText, onAttachmentPress]);

  // Focus handlers
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  const maxInputHeight = (7 * 22) + 20;
  const shouldShowToolbar = showRichTextToolbar && Platform.OS !== 'web' && RichToolbar;

  return (
    <View className="bg-white w-full">
      {/* Link Previews */}
      {linkPreviews.length > 0 && (
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

      {/* Main Input Row */}
      <View className="flex-row items-end px-3 py-2">
        {/* Format Toggle Button */}
        {Platform.OS !== 'web' && RichEditor && (
          <TouchableOpacity
            onPress={handleToggleRichText}
            className={`w-10 h-10 rounded-full items-center justify-center mr-2 mb-0.5 ${
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
        <View className="flex-1 bg-gray-50 rounded-3xl mr-2 border border-gray-200 overflow-hidden min-h-[40px]">
          {/* Reply Preview */}
          {replyToMessage && (
            <View className="mx-3 mt-2 p-2.5 bg-green-100 rounded-xl border-l-[3px] border-green-600 flex-row justify-between mb-1">
              <View className="flex-1">
                <Text className="text-green-600 text-xs font-bold mb-0.5">
                  {replyToMessage.senderId === currentUser?.userId ? 'You' : replyToMessage.senderName}
                </Text>
                <Text className="text-gray-600 text-xs" numberOfLines={3} ellipsizeMode="tail">
                  {getReplyPreviewText(replyToMessage)}
                </Text>
              </View>
              <TouchableOpacity onPress={onCancelReply} className="p-1">
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input Editor */}
          {showRichTextToolbar && Platform.OS !== 'web' && RichEditor ? (
            <View style={{ minHeight: 40, maxHeight: maxInputHeight }}>
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
                onFocus={handleFocus}
                onBlur={handleBlur}
                editorStyle={{
                  backgroundColor: "#F9FAFB",
                  placeholderColor: "#9CA3AF",
                  contentCSSText: `
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 16px; 
                    line-height: 22px; 
                    color: #1F2937;
                    padding: 12px;
                    min-height: 40px;
                    max-height: ${maxInputHeight}px;
                  `,
                }}
                style={{
                  backgroundColor: '#F9FAFB',
                  minHeight: 40,
                  maxHeight: maxInputHeight,
                }}
              />
            </View>
          ) : (
            <TextInput
              ref={inputRef}
              value={messageText}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              multiline
              className="px-4 py-2.5 text-base text-gray-800"
              style={{ 
                height: inputHeight, 
                maxHeight: maxInputHeight,
                lineHeight: 22,
                textAlignVertical: 'top',
              }}
              onContentSizeChange={(event) => {
                const contentHeight = event.nativeEvent?.contentSize?.height;
                if (!contentHeight) return;

                if (heightUpdateTimeoutRef.current) {
                  clearTimeout(heightUpdateTimeoutRef.current);
                }

                heightUpdateTimeoutRef.current = setTimeout(() => {
                  const newHeight = Math.min(Math.max(40, Math.ceil(contentHeight)), maxInputHeight);
                  if (Math.abs(newHeight - inputHeight) >= 2) {
                    setInputHeight(newHeight);
                  }
                }, 50);
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              scrollEnabled={inputHeight >= maxInputHeight}
            />
          )}
        </View>

        {/* Send/Attach Button */}
        <TouchableOpacity
          onPress={handleSendPress}
          disabled={sending}
          className="w-11 h-11 rounded-full bg-green-600 items-center justify-center mb-0.5"
          style={{
            shadowColor: '#1DAB61',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : !isEmpty ? (
            <Ionicons name="send" size={20} color="#fff" />
          ) : (
            <Animated.View style={{ transform: [{ rotate: plusRotate }] }}>
              <Ionicons name="add" size={28} color="#fff" />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      {/* Rich Text Toolbar */}
      <AnimatedToolbar visible={shouldShowToolbar}>
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
      />

      {/* Inline Link Input */}
      <InlineLinkInput
        visible={showLinkInput}
        onInsert={handleInsertLink}
        onClose={() => setShowLinkInput(false)}
        editorRef={richTextRef}
      />
    </View>
  );
}

