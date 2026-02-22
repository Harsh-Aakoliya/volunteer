// components/chat/EditMessageModal.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/types/type';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import RenderHtml from 'react-native-render-html';
import { isHtmlContent, cleanHtml } from '@/components/chat/message';
import MessageInput from '@/components/chat/MessageInput';

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
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (message && visible) {
      setEditedText(message.messageText || '');
    }
  }, [message, visible]);

  useEffect(() => {
    if (!visible) {
      setEditedText('');
    }
  }, [visible]);

  const handleSaveFromInput = useCallback(async (text: string) => {
    if (!message) return;

    const contentToSave = text.trim();
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
  }, [message, roomId, onMessageEdited, onClose]);

  const handleCancel = useCallback(() => {
    const originalText = message?.messageText || '';
    const currentText = cleanHtml(editedText);
    
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
  }, [message, editedText, onClose]);

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

          {/* Input - uses shared MessageInput */}
          {visible && message && (
            <MessageInput
              key={`edit-${message.id}`}
              messageText={editedText}
              onChangeText={setEditedText}
              onSend={(text) => handleSaveFromInput(text)}
              placeholder="Message"
              sending={isEditing}
              showAttachmentButton={false}
              showAudioButton={false}
              initialContent={message.messageText || ''}
              sendIconName="checkmark"
              showScheduleOption={false}
              containerClassName="bg-[#E5DDD5] w-full pb-1"
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
