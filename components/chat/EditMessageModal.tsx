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
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/types/type';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import RenderHtml from 'react-native-render-html';

// ----------------------------------------------------------------------
// Conditional Imports for Native Rich Editor
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

// System fonts for RenderHtml
const systemFonts = Platform.select({
  ios: ['System'],
  android: ['sans-serif', 'sans-serif-medium', 'sans-serif-light'],
  default: ['System'],
});

// Heading types
type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | null;

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------
const cleanHtml = (html: string) => {
  if (!html) return "";
  let text = html;

  text = text.replace(
    /<font\s+color=["']?((?:#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|[a-z]+))["']?>(.*?)<\/font>/gi,
    '<span style="color:$1">$2</span>'
  );

  text = text.replace(/^(<br\s*\/?>|&nbsp;|\s|<div>\s*<\/div>)+/, '');
  text = text.replace(/(<br\s*\/?>|&nbsp;|\s|<div>\s*<\/div>)+$/, '');
  
  return text.trim();
};

const stripHtml = (html: string) => {
  if (!html) return "";
  let text = html.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ''); 
  text = text.replace(/&nbsp;/g, ' '); 
  return text.trim();
};

const isHtmlContent = (text: string): boolean => {
  return /<[a-z][\s\S]*>/i.test(text);
};

const detectCurrentHeading = (html: string): HeadingLevel => {
  if (!html) return null;
  const headingMatch = html.match(/<(h[1-6])[^>]*>/i);
  if (headingMatch) {
    return headingMatch[1].toLowerCase() as HeadingLevel;
  }
  return null;
};

// ----------------------------------------------------------------------
// Color Picker Component
// ----------------------------------------------------------------------
const ColorPicker = ({ onSelect, type }: { onSelect: (color: string) => void; type: 'text' | 'background' }) => {
  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000',
    '#FFC0CB', '#A52A2A', '#808080', '#FFFFFF', '#1DAB61'
  ];

  return (
    <View style={editStyles.colorPickerContainer}>
      <Text style={editStyles.colorPickerTitle}>
        {type === 'text' ? 'Text Color' : 'Background Color'}
      </Text>
      <View style={editStyles.colorGrid}>
        {colors.map((color) => (
          <TouchableOpacity
            key={color}
            onPress={() => onSelect(color)}
            style={[
              editStyles.colorSwatch,
              { backgroundColor: color },
              color === '#FFFFFF' && editStyles.whiteSwatchBorder
            ]}
          />
        ))}
      </View>
    </View>
  );
};

// ----------------------------------------------------------------------
// Heading Picker Overlay Component
// ----------------------------------------------------------------------
const HeadingPickerOverlay = ({ 
  visible, 
  selectedHeading,
  onSelect, 
  onClose 
}: { 
  visible: boolean;
  selectedHeading: HeadingLevel;
  onSelect: (heading: HeadingLevel) => void; 
  onClose: () => void;
}) => {
  if (!visible) return null;

  const headings: HeadingLevel[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  return (
    <View style={editStyles.headingPickerOverlay}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={editStyles.headingPickerContent}
      >
        {headings.map((heading) => (
          <TouchableOpacity
            key={heading}
            onPress={() => onSelect(heading)}
            style={[
              editStyles.headingOption,
              selectedHeading === heading && editStyles.headingOptionSelected
            ]}
          >
            <Text style={[
              editStyles.headingOptionText,
              selectedHeading === heading && editStyles.headingOptionTextSelected
            ]}>
              {heading?.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={onClose}
          style={editStyles.headingCloseButton}
        >
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// ----------------------------------------------------------------------
// Link Input Modal
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
      <View style={editStyles.linkModalOverlay}>
        <View style={editStyles.linkModalContent}>
          <View style={editStyles.linkModalHeader}>
            <Text style={editStyles.linkModalTitle}>Insert Link</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com"
            style={editStyles.linkInput}
            autoCapitalize="none"
            keyboardType="url"
          />
          
          <TextInput
            value={linkText}
            onChangeText={setLinkText}
            placeholder="Link text (optional)"
            style={editStyles.linkInput}
          />
          
          <TouchableOpacity 
            onPress={handleInsert}
            style={editStyles.linkInsertButton}
          >
            <Text style={editStyles.linkInsertButtonText}>Insert Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ----------------------------------------------------------------------
// Styled Message Preview Component
// ----------------------------------------------------------------------
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
      <Text style={editStyles.plainMessageText}>
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

// ----------------------------------------------------------------------
// Main Edit Message Modal Component
// ----------------------------------------------------------------------
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

  /* ---------------- REFS ---------------- */
  const textInputRef = useRef<TextInput>(null);
  const richTextRef = useRef<any>(null);

  /* ---------------- STATE ---------------- */
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showRichTextToolbar, setShowRichTextToolbar] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'background' | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showHeadingPicker, setShowHeadingPicker] = useState(false);
  const [selectedHeading, setSelectedHeading] = useState<HeadingLevel>(null);
  const [inputHeight, setInputHeight] = useState(44);

  const maxInputHeight = 120;

  /* ---------------- EFFECTS ---------------- */
  useEffect(() => {
    if (message && visible) {
      const originalText = message.messageText || '';
      setEditedText(originalText);
      
      // Check if original message has HTML formatting
      const hasFormatting = isHtmlContent(originalText);
      setShowRichTextToolbar(hasFormatting);
      
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

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });

    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setShowHeadingPicker(false);
    });

    return () => {
      keyboardShowListener?.remove();
      keyboardHideListener?.remove();
    };
  }, []);

  useEffect(() => {
    if (showRichTextToolbar) {
      const detected = detectCurrentHeading(editedText);
      setSelectedHeading(detected);
    }
  }, [editedText, showRichTextToolbar]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setShowRichTextToolbar(false);
      setShowColorPicker(null);
      setShowLinkModal(false);
      setShowHeadingPicker(false);
      setSelectedHeading(null);
      setInputHeight(44);
    }
  }, [visible]);

  /* ---------------- HANDLERS ---------------- */
  const handleToggleRichText = useCallback(() => {
    if (Platform.OS === 'web') return;

    const nextState = !showRichTextToolbar;
    const wasKeyboardVisible = isKeyboardVisible;
    
    setShowRichTextToolbar(nextState);
    setShowHeadingPicker(false);
    setSelectedHeading(null);

    if (nextState) {
      const htmlContent = editedText ? editedText.replace(/\n/g, '<br>') : '';
      const finalHtml = htmlContent ? `<div>${htmlContent}</div>` : '';
      
      setTimeout(() => {
        if (richTextRef.current) {
          richTextRef.current.setContentHTML(finalHtml);
          if (wasKeyboardVisible) {
            richTextRef.current.focusContentEditor();
          }
        }
      }, 100);
    } else {
      const plainText = stripHtml(editedText);
      setEditedText(plainText);
      
      setTimeout(() => {
        if (wasKeyboardVisible) {
          textInputRef.current?.focus();
        }
      }, 100);
    }
  }, [showRichTextToolbar, editedText, isKeyboardVisible]);

  const handleColorSelect = (color: string) => {
    if (showColorPicker === 'text') {
      richTextRef.current?.setForeColor(color);
    } else if (showColorPicker === 'background') {
      richTextRef.current?.setHiliteColor(color);
    }
    setShowColorPicker(null);
  };

  const handleHeadingSelect = (heading: HeadingLevel) => {
    if (!richTextRef.current) return;

    if (selectedHeading === heading) {
      richTextRef.current?.sendAction(actions.setParagraph, 'result');
      setSelectedHeading(null);
    } else {
      switch (heading) {
        case 'h1':
          richTextRef.current?.sendAction(actions.heading1, 'result');
          break;
        case 'h2':
          richTextRef.current?.sendAction(actions.heading2, 'result');
          break;
        case 'h3':
          richTextRef.current?.sendAction(actions.heading3, 'result');
          break;
        case 'h4':
          richTextRef.current?.sendAction(actions.heading4, 'result');
          break;
        case 'h5':
          richTextRef.current?.sendAction(actions.heading5, 'result');
          break;
        case 'h6':
          richTextRef.current?.sendAction(actions.heading6, 'result');
          break;
      }
      setSelectedHeading(heading);
    }
    setShowHeadingPicker(false);
  };

  const handleInsertLink = (url: string, text: string) => {
    if (showRichTextToolbar && richTextRef.current) {
      richTextRef.current?.insertLink(text, url);
    } else {
      const linkMarkdown = `[${text}](${url})`;
      setEditedText(editedText + linkMarkdown);
    }
  };

  const toggleColorPicker = (type: 'text' | 'background') => {
    setShowHeadingPicker(false);
    if (showColorPicker === type) {
      setShowColorPicker(null);
    } else {
      setShowColorPicker(type);
    }
  };

  const toggleHeadingPicker = () => {
    setShowColorPicker(null);
    setShowHeadingPicker(!showHeadingPicker);
  };

  const isEmpty = useMemo(() => {
    if (showRichTextToolbar) {
      const textOnly = stripHtml(editedText);
      return textOnly.length === 0;
    }
    return editedText.trim().length === 0;
  }, [editedText, showRichTextToolbar]);

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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={editStyles.modalContainer}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined} 
          style={editStyles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {/* Header */}
          <View style={editStyles.header}>
            <TouchableOpacity onPress={handleCancel} style={editStyles.headerBackButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={editStyles.headerTitle}>Edit message</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Middle area - shows original message preview */}
          <View style={editStyles.previewContainer}>
            <ScrollView 
              contentContainerStyle={editStyles.previewScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={editStyles.previewMessageContainer}>
                <Text style={editStyles.previewLabel}>Original message:</Text>
                <View style={editStyles.previewBubble}>
                  <MessagePreview content={message.messageText || ''} />
                  {message.isEdited && (
                    <View style={editStyles.editedIndicator}>
                      <Text style={editStyles.editedText}>edited</Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Bottom Input Section */}
          <View style={editStyles.inputSection}>
            <View style={editStyles.inputRow}>
              {/* Format Toggle Button */}
              <TouchableOpacity
                onPress={handleToggleRichText}
                style={[
                  editStyles.formatButton,
                  showRichTextToolbar && editStyles.formatButtonActive
                ]}
              >
                <Ionicons 
                  name="text" 
                  size={20} 
                  color={showRichTextToolbar ? '#1DAB61' : '#666666'}
                />
              </TouchableOpacity>

              {/* Input Container */}
              <View style={editStyles.inputContainer}>
                {showRichTextToolbar && Platform.OS !== 'web' && RichEditor ? (
                  <View style={{ minHeight: 44, maxHeight: maxInputHeight }}>
                    <RichEditor
                      ref={richTextRef}
                      onChange={setEditedText}
                      placeholder="Message"
                      initialContentHTML={editedText}
                      initialHeight={maxInputHeight}
                      androidHardwareAccelerationDisabled={true}
                      androidLayerType="software"
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
                    style={[
                      editStyles.textInput,
                      { height: Math.min(Math.max(44, inputHeight), maxInputHeight) }
                    ]}
                    placeholder="Message"
                    placeholderTextColor="#8696A0"
                    value={editedText}
                    onChangeText={setEditedText}
                    multiline
                    editable={!isEditing}
                    maxLength={4096}
                    textAlignVertical="center"
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
                style={[
                  editStyles.saveButton,
                  (isEditing || isEmpty) && editStyles.saveButtonDisabled
                ]}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={isEditing || isEmpty}
              >
                {isEditing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={26} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Rich Text Toolbar */}
            {showRichTextToolbar && isKeyboardVisible && Platform.OS !== 'web' && RichToolbar && (
              <View style={editStyles.formatToolbar}>
                {/* Heading Picker Overlay */}
                <HeadingPickerOverlay
                  visible={showHeadingPicker}
                  selectedHeading={selectedHeading}
                  onSelect={handleHeadingSelect}
                  onClose={() => setShowHeadingPicker(false)}
                />
                
                <RichToolbar
                  editor={richTextRef}
                  selectedIconTint="#1DAB61"
                  iconTint="#666"
                  actions={[
                    'heading',
                    actions.setBold,
                    actions.setItalic,
                    actions.setUnderline,
                    actions.setStrikethrough,
                    'textColor',
                    'backgroundColor',
                    actions.insertLink,
                    actions.insertBulletsList,
                    actions.insertOrderedList,
                    actions.alignCenter,
                  ]}
                  iconMap={{
                    heading: ({ tintColor }: any) => (
                      <TouchableOpacity 
                        onPress={toggleHeadingPicker} 
                        style={[
                          editStyles.headingButton,
                          selectedHeading && editStyles.headingButtonActive
                        ]}
                      >
                        <Text style={[
                          editStyles.headingButtonText, 
                          { color: selectedHeading ? '#1DAB61' : tintColor }
                        ]}>
                          {selectedHeading ? selectedHeading.toUpperCase() : 'H'}
                        </Text>
                        <Ionicons 
                          name={showHeadingPicker ? "chevron-up" : "chevron-down"} 
                          size={12} 
                          color={selectedHeading ? '#1DAB61' : tintColor} 
                        />
                      </TouchableOpacity>
                    ),
                    [actions.setBold]: ({ tintColor }: any) => (
                      <View style={editStyles.simpleToolIcon}>
                        <Text style={[editStyles.textIconLabel, { color: tintColor }]}>B</Text>
                      </View>
                    ),
                    [actions.setItalic]: ({ tintColor }: any) => (
                      <View style={editStyles.simpleToolIcon}>
                        <Text style={[editStyles.textIconLabel, { fontStyle: 'italic', color: tintColor }]}>I</Text>
                      </View>
                    ),
                    [actions.setUnderline]: ({ tintColor }: any) => (
                      <View style={editStyles.simpleToolIcon}>
                        <Text style={[editStyles.textIconLabel, { textDecorationLine: 'underline', color: tintColor }]}>U</Text>
                      </View>
                    ),
                    [actions.setStrikethrough]: ({ tintColor }: any) => (
                      <View style={editStyles.simpleToolIcon}>
                        <Text style={[editStyles.textIconLabel, { textDecorationLine: 'line-through', color: tintColor }]}>S</Text>
                      </View>
                    ),
                    textColor: ({ tintColor }: any) => (
                      <TouchableOpacity onPress={() => toggleColorPicker('text')} style={editStyles.simpleToolIcon}>
                        <Ionicons name="color-palette" size={22} color={tintColor} />
                      </TouchableOpacity>
                    ),
                    backgroundColor: ({ tintColor }: any) => (
                      <TouchableOpacity onPress={() => toggleColorPicker('background')} style={editStyles.simpleToolIcon}>
                        <Ionicons name="color-fill" size={22} color={tintColor} />
                      </TouchableOpacity>
                    ),
                    [actions.insertLink]: ({ tintColor }: any) => (
                      <TouchableOpacity onPress={() => setShowLinkModal(true)} style={editStyles.simpleToolIcon}>
                        <Ionicons name="link" size={22} color={tintColor} />
                      </TouchableOpacity>
                    ),
                    [actions.insertBulletsList]: ({ tintColor }: any) => (
                      <View style={editStyles.simpleToolIcon}>
                        <Ionicons name="list" size={24} color={tintColor} />
                      </View>
                    ),
                    [actions.insertOrderedList]: ({ tintColor }: any) => (
                      <View style={editStyles.simpleToolIcon}>
                        <Ionicons name="list-outline" size={24} color={tintColor} />
                      </View>
                    ),
                  }}
                  style={editStyles.richToolbar}
                  flatContainerStyle={editStyles.flatToolbarContainer}
                />
              </View>
            )}
          </View>

          {/* Color Picker Modal */}
          {showColorPicker && (
            <Modal transparent visible={!!showColorPicker} onRequestClose={() => setShowColorPicker(null)}>
              <TouchableOpacity 
                style={editStyles.colorModalOverlay} 
                activeOpacity={1}
                onPress={() => setShowColorPicker(null)}
              >
                <View style={editStyles.colorPickerModal}>
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#008069',
  },
  headerBackButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#E5DDD5',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  previewMessageContainer: {
    alignItems: 'flex-end',
  },
  previewLabel: {
    fontSize: 12,
    color: '#667781',
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  previewBubble: {
    maxWidth: '80%',
    backgroundColor: '#DCF8C6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  plainMessageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
  },
  editedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  editedText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  inputSection: {
    backgroundColor: '#E5DDD5',
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  formatButton: {
    width: 40,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  formatButtonActive: {
    backgroundColor: '#E8F5E9',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 17,
    lineHeight: 22,
    color: '#111B21',
    minHeight: 44,
    maxHeight: 120,
  },
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1DAB61',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1DAB61',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  formatToolbar: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  richToolbar: {
    backgroundColor: '#FFFFFF',
    height: 50,
    borderRadius: 12,
  },
  flatToolbarContainer: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  simpleToolIcon: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  textIconLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Heading Button Styles
  headingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 4,
  },
  headingButtonActive: {
    backgroundColor: '#E8F5E9',
  },
  headingButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 2,
  },
  // Heading Picker Overlay
  headingPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    zIndex: 100,
    justifyContent: 'center',
    borderRadius: 12,
  },
  headingPickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 50,
  },
  headingOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headingOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#1DAB61',
  },
  headingOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  headingOptionTextSelected: {
    color: '#1DAB61',
  },
  headingCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Color Picker
  colorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  colorPickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 320,
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
  // Link Modal
  linkModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  linkModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  linkModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  linkModalTitle: {
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
  linkInsertButton: {
    backgroundColor: '#1DAB61',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  linkInsertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});