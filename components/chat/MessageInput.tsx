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
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatUser, Message } from '@/types/type';
import { cssInterop } from 'nativewind';

// ----------------------------------------------------------------------
// 1. Conditional Imports for Native Rich Editor
// ----------------------------------------------------------------------
let RichEditor: any = null;
let RichToolbar: any = null;
let actions: any = {};

if (Platform.OS !== 'web') {
  try {
    const richEditorModule = require('react-native-pell-rich-editor');
    RichEditor = richEditorModule.RichEditor;
    RichToolbar = richEditorModule.RichToolbar;
    actions = richEditorModule.actions;
  } catch (e) {
    console.warn('react-native-pell-rich-editor not available');
  }
}

let StyledRichEditor: any = null;
let StyledRichToolbar: any = null;

if (RichEditor) {
  const ForwardedRichEditor = React.forwardRef<typeof RichEditor, any>((props, ref) => (
    <RichEditor {...props} ref={ref} />
  ));
  StyledRichEditor = cssInterop(ForwardedRichEditor, { className: "style" });
  StyledRichToolbar = cssInterop(RichToolbar, { className: "style" });
}

// ----------------------------------------------------------------------
// 2. Props Interface
// ----------------------------------------------------------------------
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
  replyToMessage?: Message | null; 
  onCancelReply?: () => void; 
  onAttachmentPress?: () => void; 
  isAttachmentSheetOpen?: boolean; 
}

// ----------------------------------------------------------------------
// 3. Helper: Strip HTML
// ----------------------------------------------------------------------
const stripHtml = (html: string) => {
  if (!html) return "";
  let text = html.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ''); 
  text = text.replace(/&nbsp;/g, ' '); 
  return text.trim();
};

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

  /* ---------------- REFS ---------------- */
  const inputRef = useRef<TextInput>(null);
  const richTextRef = useRef<typeof RichEditor>(null);
  const plusAnim = useRef(new Animated.Value(0)).current;

  /* ---------------- STATE ---------------- */
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const inputHeightRef = useRef(40); // Use ref to avoid flicker
  const [inputHeight, setInputHeight] = useState(40); // Starting height for 1 line
  const heightUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------- ANIMATION ---------------- */
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

  /* ---------------- KEYBOARD LISTENERS ---------------- */
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

  /* ---------------- TOGGLE LOGIC ---------------- */
  const handleToggleRichText = useCallback(() => {
    if (Platform.OS === 'web') return; 

    const nextState = !showRichTextToolbar;
    const wasKeyboardVisible = isKeyboardVisible; // Preserve keyboard state
    
    setShowRichTextToolbar(nextState);

    if (nextState) {
      // Switching TO Rich Text
      const htmlContent = messageText ? messageText.replace(/\n/g, '<br>') : '';
      const finalHtml = htmlContent ? `<div>${htmlContent}</div>` : '';
      
      setTimeout(() => {
        if(richTextRef.current) {
          richTextRef.current.setContentHTML(finalHtml);
          // Only focus if keyboard was already visible
          if (wasKeyboardVisible) {
            richTextRef.current.focusContentEditor();
          }
        }
      }, 100);
    } else {
      // Switching BACK to Plain Text
      const plainText = stripHtml(messageText);
      onChangeText(plainText);
      
      setTimeout(() => {
        // Only focus if keyboard was already visible
        if (wasKeyboardVisible) {
          inputRef.current?.focus();
        }
      }, 100);
    }
  }, [showRichTextToolbar, messageText, onChangeText, isKeyboardVisible]);

  const handleRichTextChange = (html: string) => {
    onChangeText(html); 
  };

  const handleStandardTextChange = (text: string) => {
    onChangeText(text);
  };

  // Calculate input height based on content (max 7 lines)
  // This is a fallback calculation, actual height comes from onContentSizeChange
  const calculateInputHeight = useCallback((text: string) => {
    if (!text) return 40; // Minimum height for 1 line
    
    const lineHeight = 22; // line-height from CSS
    const padding = 20; // vertical padding (10px top + 10px bottom)
    const minHeight = 40;
    
    // Count newlines
    const newlineCount = (text.match(/\n/g) || []).length;
    const estimatedLines = Math.max(1, Math.min(newlineCount + 1, 7)); // Max 7 lines
    
    const calculatedHeight = (estimatedLines * lineHeight) + padding;
    return Math.max(minHeight, Math.min(calculatedHeight, (7 * lineHeight) + padding));
  }, []);

  const isEmpty = useMemo(() => {
    if (showRichTextToolbar) {
      const textOnly = stripHtml(messageText);
      return textOnly.length === 0;
    }
    return messageText.trim().length === 0;
  }, [messageText, showRichTextToolbar]);

  const handleSendPress = () => {
    if (isEmpty) {
      if (replyToMessage) return; 

      Keyboard.dismiss();
      if(showRichTextToolbar) {
        richTextRef.current?.blurContentEditor();
      } else {
        inputRef.current?.blur();
      }

      setTimeout(() => {
        onAttachmentPress?.();
      }, 100);
      return;
    }

    // 1. Send the message
    onSend(messageText, 'text', 0, 0, 0);
    
    // 2. Clear content
    onChangeText('');
    setInputHeight(40); // Reset height
    inputHeightRef.current = 40;
    
    // 3. Reset Rich Text State if active
    if (showRichTextToolbar) {
      if (richTextRef.current) {
        richTextRef.current.setContentHTML('');
        richTextRef.current.blurContentEditor();
      }
      // Deactivate the toolbar and T icon
      setShowRichTextToolbar(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (heightUpdateTimeoutRef.current) {
        clearTimeout(heightUpdateTimeoutRef.current);
      }
    };
  }, []);

  /* ---------------- RENDER ---------------- */
  // Calculate max height for 7 lines (line-height 22px + padding)
  const maxInputHeight = (7 * 22) + 20; // 174px for 7 lines
  
  return (
    <View className="bg-white w-full">
      {/* 2. MAIN INPUT ROW */}
      <View className="flex-row items-end px-2 py-1 bg-white">
        
        {/* A. TOGGLE BUTTON ("T") */}
        <TouchableOpacity
          onPress={handleToggleRichText}
          className="w-10 h-10 rounded-full justify-center items-center mr-2 mb-1"
          style={{
            // backgroundColor: showRichTextToolbar ? '#E8F5E9' : '#F5F5F5',
            // borderWidth: showRichTextToolbar ? 1 : 0,
            // borderColor: '#1DAB61',
          }}
        >
          <Text style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: showRichTextToolbar ? '#1DAB61' : '#666666',
          }}>
            T
          </Text>
        </TouchableOpacity>

        {/* B. INPUT CONTAINER */}
        <View className="flex-1 bg-white rounded-[20px] mr-2 border border-gray-50 overflow-hidden min-h-[40px]">
          
          {/* Reply Preview */}
          {replyToMessage && (
            <View className="mx-2 mt-2 p-2 bg-[#F0F2F5] rounded-[12px] border-l-4 border-[#00A884] flex-row justify-between mb-1">
              <View className="flex-1">
                <Text className="text-[#00A884] text-xs font-bold">
                  {replyToMessage.senderId === currentUser?.userId ? 'You' : replyToMessage.senderName}
                </Text>
                <Text className="text-gray-500 text-xs" numberOfLines={1}>
                  {replyToMessage.messageText}
                </Text>
              </View>
              <TouchableOpacity onPress={onCancelReply} className="p-1">
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input Logic */}
          {showRichTextToolbar && Platform.OS !== 'web' && StyledRichEditor ? (
            // Rich Text Editor - Max 7 lines then scrollable
            <View style={{ 
              minHeight: 40, 
              maxHeight: maxInputHeight,
              height: maxInputHeight,
              overflow: 'hidden',
            }}>
              <StyledRichEditor
                ref={richTextRef}
                onChange={handleRichTextChange}
                placeholder={placeholder}
                initialContentHTML={messageText}
                initialHeight={maxInputHeight}
                androidHardwareAccelerationDisabled={true}
                androidLayerType="software"
                onFocus={() => {
                  setIsFocused(true);
                  onFocus?.();
                }}
                onBlur={() => {
                  setIsFocused(false);
                  onBlur?.();
                }}
                editorStyle={{
                  backgroundColor: "#ffffff",
                  placeholderColor: "#9CA3AF",
                  contentCSSText: `
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 16px; 
                    line-height: 22px; 
                    color: #1F2937;
                    padding-left: 10px;
                    padding-right: 10px;
                    padding-top: 8px; 
                    padding-bottom: 8px;
                    min-height: 40px;
                    max-height: ${maxInputHeight}px;
                    height: ${maxInputHeight}px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    word-wrap: break-word;
                  `,
                }}
                style={{ 
                  backgroundColor: '#fff', 
                  minHeight: 40,
                  maxHeight: maxInputHeight,
                  height: maxInputHeight,
                  width: '100%',
                }}
              />
            </View>
          ) : (
            // Regular TextInput - Dynamic height up to 7 lines, then scrollable
            <TextInput
              ref={inputRef}
              value={messageText}
              onChangeText={handleStandardTextChange}
              placeholder={placeholder}
              multiline
              className="px-3 text-[16px] text-gray-800"
              style={{ 
                height: inputHeight,
                minHeight: 40,
                maxHeight: maxInputHeight,
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 12,
                paddingRight: 12,
                fontSize: 16,
                lineHeight: 22,
                color: '#1F2937',
                textAlignVertical: 'top',
              }}
              onContentSizeChange={(event) => {
                // Extract values immediately before event is pooled
                const contentHeight = event.nativeEvent?.contentSize?.height;
                if (!contentHeight) return;
                
                // Debounce height updates to prevent flicker
                if (heightUpdateTimeoutRef.current) {
                  clearTimeout(heightUpdateTimeoutRef.current);
                }
                
                heightUpdateTimeoutRef.current = setTimeout(() => {
                  const newHeight = Math.min(Math.max(40, Math.ceil(contentHeight)), maxInputHeight);
                  
                  // Only update if height actually changed significantly (avoid micro-adjustments)
                  if (Math.abs(newHeight - inputHeight) >= 2) {
                    inputHeightRef.current = newHeight;
                    setInputHeight(newHeight);
                  }
                }, 50); // Small debounce to prevent flicker
              }}
              onFocus={() => {
                setIsFocused(true);
                onFocus?.();
              }}
              onBlur={() => {
                setIsFocused(false);
                onBlur?.();
              }}
              scrollEnabled={inputHeight >= maxInputHeight}
            />
          )}
        </View>

        {/* C. SEND / ATTACH BUTTON */}
        <TouchableOpacity
          onPress={handleSendPress}
          disabled={sending}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#1DAB61',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : !isEmpty ? (
            <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 1 }} />
          ) : (
            <Animated.View style={{ transform: [{ rotate: plusRotate }] }}>
              <Ionicons name="add" size={28} color="#fff" />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      {/* 1. TOOLBAR AREA - Positioned above keyboard, only when T is active AND keyboard is visible */}
      {showRichTextToolbar && isKeyboardVisible && Platform.OS !== 'web' && StyledRichToolbar && richTextRef.current && (
        <View style={styles.toolbarContainer}>
          <StyledRichToolbar
            editor={richTextRef}
            selectedIconTint="#1DAB61"
            iconTint="#666"
            style={styles.toolbar}
            actions={[
              actions.setBold,
              actions.setItalic,
              actions.setUnderline,
              actions.setStrikethrough,
              actions.insertOrderedList,
              actions.insertBulletsList,
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarContainer: {
    backgroundColor: '#F9FAFB',
    borderTopWidth:0,
    borderBottomWidth: 0,
    borderColor: '#E5E7EB',
    marginBottom: 4,
    marginHorizontal: 0,
    paddingVertical: 2,
  },
  toolbar: {
    backgroundColor: '#F9FAFB',
    height: 44,
  },
}); 