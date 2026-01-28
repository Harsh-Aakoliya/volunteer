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
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getReplyPreviewText } from '@/utils/messageHelpers';

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
  replyToMessage?: any | null; 
  onCancelReply?: () => void; 
  onAttachmentPress?: () => void; 
  isAttachmentSheetOpen?: boolean; 
}

// ----------------------------------------------------------------------
// 3. Helper Functions
// ----------------------------------------------------------------------

const extractLinks = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

// IMPROVED CLEAN HTML FUNCTION
const cleanHtml = (html: string) => {
  if (!html) return "";
  let text = html;

  // 1. Convert <font color="#color">...</font> to <span style="color: #color">...</span>
  // This is crucial because RenderHTML prioritizes 'style' attributes over 'color' attributes
  text = text.replace(
    /<font\s+color=["']?((?:#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|[a-z]+))["']?>(.*?)<\/font>/gi,
    '<span style="color:$1">$2</span>'
  );

  // 2. Remove empty paragraphs/divs/breaks at the start
  text = text.replace(/^(<br\s*\/?>|&nbsp;|\s|<div>\s*<\/div>)+/, '');
  
  // 3. Remove empty paragraphs/divs/breaks at the end
  text = text.replace(/(<br\s*\/?>|&nbsp;|\s|<div>\s*<\/div>)+$/, '');
  
  return text.trim();
};

const stripHtml = (html: string) => {
  if (!html) return "";
  // Simple strip for checking if empty
  let text = html.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ''); 
  text = text.replace(/&nbsp;/g, ' '); 
  return text.trim();
};

// ----------------------------------------------------------------------
// 4. Color Picker Component
// ----------------------------------------------------------------------
const ColorPicker = ({ onSelect, type }: { onSelect: (color: string) => void; type: 'text' | 'background' }) => {
  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000',
    '#FFC0CB', '#A52A2A', '#808080', '#FFFFFF', '#1DAB61'
  ];

  return (
    <View style={styles.colorPickerContainer}>
      <Text style={styles.colorPickerTitle}>
        {type === 'text' ? 'Text Color' : 'Background Color'}
      </Text>
      <View style={styles.colorGrid}>
        {colors.map((color) => (
          <TouchableOpacity
            key={color}
            onPress={() => onSelect(color)}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              color === '#FFFFFF' && styles.whiteSwatchBorder
            ]}
          />
        ))}
      </View>
    </View>
  );
};

// ----------------------------------------------------------------------
// 5. Link Input Modal
// ----------------------------------------------------------------------
const LinkInputModal = ({ 
  visible, 
  onClose, 
  onInsert 
}: { 
  visible: boolean; 
  onClose: () => void; 
  onInsert: (url: string, text: string) => void;
}) => {
  const [url, setUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const handleInsert = () => {
    if (url.trim()) {
      onInsert(url.trim(), linkText.trim() || url.trim());
      setUrl('');
      setLinkText('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Insert Link</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com"
            style={styles.linkInput}
            autoCapitalize="none"
            keyboardType="url"
          />
          
          <TextInput
            value={linkText}
            onChangeText={setLinkText}
            placeholder="Link text (optional)"
            style={styles.linkInput}
          />
          
          <TouchableOpacity 
            onPress={handleInsert}
            style={styles.insertButton}
          >
            <Text style={styles.insertButtonText}>Insert Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ----------------------------------------------------------------------
// 6. Link Preview Component
// ----------------------------------------------------------------------
const LinkPreview = ({ url, onRemove }: { url: string; onRemove: () => void }) => {
  const domain = useMemo(() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }, [url]);

  return (
    <View style={styles.linkPreviewContainer}>
      <View style={styles.linkPreviewContent}>
        <View style={styles.linkIconContainer}>
          <Ionicons name="link" size={20} color="#1DAB61" />
        </View>
        <View style={styles.linkPreviewText}>
          <Text style={styles.linkPreviewDomain} numberOfLines={1}>
            {domain}
          </Text>
          <Text style={styles.linkPreviewUrl} numberOfLines={1}>
            {url}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.linkPreviewRemove}>
        <Ionicons name="close-circle" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );
};

// ----------------------------------------------------------------------
// 7. Main Component
// ----------------------------------------------------------------------
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
  const richTextRef = useRef<any>(null);
  const plusAnim = useRef(new Animated.Value(0)).current;

  /* ---------------- STATE ---------------- */
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'background' | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<string[]>([]);
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

  /* ---------------- LINK DETECTION ---------------- */
  useEffect(() => {
    const links = extractLinks(messageText);
    setLinkPreviews(links);
  }, [messageText]);

  /* ---------------- HANDLERS ---------------- */
  const handleToggleRichText = useCallback(() => {
    if (Platform.OS === 'web') return; 

    const nextState = !showRichTextToolbar;
    const wasKeyboardVisible = isKeyboardVisible;
    
    setShowRichTextToolbar(nextState);

    if (nextState) {
      const htmlContent = messageText ? messageText.replace(/\n/g, '<br>') : '';
      const finalHtml = htmlContent ? `<div>${htmlContent}</div>` : '';
      
      setTimeout(() => {
        if(richTextRef.current) {
          richTextRef.current.setContentHTML(finalHtml);
          if (wasKeyboardVisible) {
            richTextRef.current.focusContentEditor();
          }
        }
      }, 100);
    } else {
      const plainText = stripHtml(messageText);
      onChangeText(plainText);
      
      setTimeout(() => {
        if (wasKeyboardVisible) {
          inputRef.current?.focus();
        }
      }, 100);
    }
  }, [showRichTextToolbar, messageText, onChangeText, isKeyboardVisible]);

  const handleColorSelect = (color: string) => {
    if (showColorPicker === 'text') {
      richTextRef.current?.setForeColor(color);
    } else if (showColorPicker === 'background') {
      richTextRef.current?.setHiliteColor(color);
    }
    setShowColorPicker(null);
  };

  const handleInsertLink = (url: string, text: string) => {
    if (showRichTextToolbar && richTextRef.current) {
      richTextRef.current?.insertLink(text, url);
    } else {
      const linkMarkdown = `[${text}](${url})`;
      onChangeText(messageText + linkMarkdown);
    }
  };

  const handleRemoveLinkPreview = (url: string) => {
    const newText = messageText.replace(url, '');
    onChangeText(newText);
  };

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
    const contentToSend = showRichTextToolbar 
        ? cleanHtml(messageText) 
        : messageText.trim();

    onSend(contentToSend, 'text', 0, 0, 0);
    
    onChangeText('');
    setInputHeight(40);
    setLinkPreviews([]);
    
    if (showRichTextToolbar) {
      if (richTextRef.current) {
        richTextRef.current.setContentHTML('');
        richTextRef.current.blurContentEditor();
      }
      setShowRichTextToolbar(false);
    }
  };

  const toggleColorPicker = (type: 'text' | 'background') => {
    // If clicking same type, close it. If clicking different, switch.
    if (showColorPicker === type) {
      setShowColorPicker(null);
    } else {
      setShowColorPicker(type);
    }
  };

  /* ---------------- RENDER ---------------- */
  const maxInputHeight = (7 * 22) + 20;
  
  return (
    <View style={styles.container}>
      
      {/* Link Previews */}
      {linkPreviews.length > 0 && (
        <View style={styles.linkPreviewsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
      <View style={styles.inputRow}>
        
        {/* Format Toggle Button */}
        <TouchableOpacity
          onPress={handleToggleRichText}
          style={[
            styles.formatButton,
            showRichTextToolbar && styles.formatButtonActive
          ]}
        >
          <Ionicons 
            name="text" 
            size={20} 
            color={showRichTextToolbar ? '#1DAB61' : '#666666'}
          />
        </TouchableOpacity>

        {/* Input Container */}
        <View style={styles.inputContainer}>
          
          {/* Reply Preview */}
          {replyToMessage && (
            <View style={styles.replyPreview}>
              <View style={styles.replyContent}>
                <Text style={styles.replySender}>
                  {replyToMessage.senderId === currentUser?.userId ? 'You' : replyToMessage.senderName}
                </Text>
                <Text
                  style={styles.replyText}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {getReplyPreviewText(replyToMessage)}
                </Text>
              </View>
              <TouchableOpacity onPress={onCancelReply} style={styles.replyClose}>
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input Editor */}
          {showRichTextToolbar && Platform.OS !== 'web' && RichEditor ? (
            <View style={{ minHeight: 40, maxHeight: maxInputHeight, height: maxInputHeight }}>
              <RichEditor
                ref={richTextRef}
                onChange={onChangeText}
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
                    padding: 12px;
                    min-height: 40px;
                    max-height: ${maxInputHeight}px;
                    height: ${maxInputHeight}px;
                    overflow-y: auto;
                  `,
                }}
                style={{ 
                  backgroundColor: '#fff', 
                  minHeight: 40,
                  maxHeight: maxInputHeight,
                  height: maxInputHeight,
                }}
              />
            </View>
          ) : (
            <TextInput
              ref={inputRef}
              value={messageText}
              onChangeText={onChangeText}
              placeholder={placeholder}
              multiline
              style={[
                styles.textInput,
                { height: inputHeight, maxHeight: maxInputHeight }
              ]}
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

        {/* Send/Attach Button */}
        <TouchableOpacity
          onPress={handleSendPress}
          disabled={sending}
          style={styles.sendButton}
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
      {showRichTextToolbar && isKeyboardVisible && Platform.OS !== 'web' && RichToolbar && (
        <View style={styles.formatToolbar}>
          <RichToolbar
            editor={richTextRef}
            selectedIconTint="#1DAB61"
            iconTint="#666"
            actions={[
              actions.setBold,
              actions.setItalic,
              actions.setUnderline,
              actions.setStrikethrough,
              'textColor',
              'backgroundColor',
              actions.insertLink,
              actions.insertBulletsList,
              actions.insertOrderedList,
              actions.alignLeft,
              actions.alignCenter,
            ]}
            iconMap={{
              // REMOVED Custom styles with borders/backgrounds here
              [actions.setBold]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Text style={[styles.textIconLabel, { color: tintColor }]}>B</Text>
                </View>
              ),
              [actions.setItalic]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Text style={[styles.textIconLabel, { fontStyle: 'italic', color: tintColor }]}>I</Text>
                </View>
              ),
              [actions.setUnderline]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Text style={[styles.textIconLabel, { textDecorationLine: 'underline', color: tintColor }]}>U</Text>
                </View>
              ),
              [actions.setStrikethrough]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Text style={[styles.textIconLabel, { textDecorationLine: 'line-through', color: tintColor }]}>S</Text>
                </View>
              ),
              textColor: ({ tintColor }: any) => (
                <TouchableOpacity onPress={() => toggleColorPicker('text')} style={styles.simpleToolIcon}>
                  <Ionicons name="color-palette" size={22} color={tintColor} />
                </TouchableOpacity>
              ),
              backgroundColor: ({ tintColor }: any) => (
                <TouchableOpacity onPress={() => toggleColorPicker('background')} style={styles.simpleToolIcon}>
                  <Ionicons name="color-fill" size={22} color={tintColor} />
                </TouchableOpacity>
              ),
              [actions.insertLink]: ({ tintColor }: any) => (
                <TouchableOpacity onPress={() => setShowLinkModal(true)} style={styles.simpleToolIcon}>
                  <Ionicons name="link" size={22} color={tintColor} />
                </TouchableOpacity>
              ),
              [actions.insertBulletsList]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Ionicons name="list" size={24} color={tintColor} />
                </View>
              ),
              [actions.insertOrderedList]: ({ tintColor }: any) => (
                <View style={styles.simpleToolIcon}>
                  <Ionicons name="list-outline" size={24} color={tintColor} />
                </View>
              ),
              separator: () => <View style={styles.toolDivider} />,
            }}
            style={styles.richToolbar}
            flatContainerStyle={styles.flatToolbarContainer}
          />
        </View>
      )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <Modal transparent visible={!!showColorPicker} onRequestClose={() => setShowColorPicker(null)}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowColorPicker(null)}
          >
            <View style={styles.colorPickerModal}>
              <ColorPicker 
                type={showColorPicker} 
                onSelect={handleColorSelect}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Link Input Modal */}
      <LinkInputModal
        visible={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onInsert={handleInsertLink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  linkPreviewsContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  linkPreviewContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 10,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 200,
  },
  linkPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  linkPreviewText: {
    flex: 1,
  },
  linkPreviewDomain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  linkPreviewUrl: {
    fontSize: 12,
    color: '#6B7280',
  },
  linkPreviewRemove: {
    padding: 4,
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  formatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
    backgroundColor: '#F3F4F6',
  },
  formatButtonActive: {
    backgroundColor: '#E8F5E9',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    minHeight: 40,
  },
  replyPreview: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#1DAB61',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  replyContent: {
    flex: 1,
  },
    richToolbar: {
    backgroundColor: '#FFFFFF',
    height: 50,
  },
  replySender: {
    color: '#1DAB61',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyText: {
    color: '#6B7280',
    fontSize: 12,
  },
  replyClose: {
    padding: 4,
  },
    textIconLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
    color: '#1F2937',
    minHeight: 40,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1DAB61',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: '#1DAB61',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  formatToolbar: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#E5E7EB',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
    flatToolbarContainer: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toolLabel: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 4,
    fontWeight: '500',
  },
  toolDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  linkInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  insertButton: {
    backgroundColor: '#1DAB61',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  insertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  colorPickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 320,
  },
    simpleToolIcon: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  colorPickerContainer: {
    padding: 4,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  whiteSwatchBorder: {
    borderColor: '#E5E7EB',
  },
});