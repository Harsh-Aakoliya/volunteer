// components/chat/EditMessageModal.tsx
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/types/type';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';

interface EditMessageModalProps {
  visible: boolean;
  onClose: () => void;
  message: Message | null;
  roomId: string | number;
  roomMembers?: any[]; // Optional - kept for backward compatibility
  currentUser?: {
    userId: string;
    fullName: string | null;
  } | null; // Optional - kept for backward compatibility
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
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (message && visible) {
      const originalText = message.messageText || '';
      setEditedText(originalText);
      // Auto focus the input when modal opens
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  }, [message, visible]);

  const handleSave = async () => {
    if (!message || !editedText.trim()) {
      Alert.alert('Error', 'Message text cannot be empty');
      return;
    }

    // Check if it's a temporary message
    if (typeof message.id === 'string' && message.id.startsWith('temp-')) {
      Alert.alert('Error', 'Cannot edit temporary message. Please wait for the message to be sent.');
      return;
    }

    if (editedText.trim() === message.messageText?.trim()) {
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
        { messageText: editedText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedMessage: Message = {
        ...message,
        messageText: editedText.trim(),
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
    if (editedText !== message?.messageText) {
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
      <SafeAreaView className="flex-1 bg-black/50">
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined} 
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {/* Header */}
          <View className="flex-row items-center px-4 py-3 bg-[#008069]">
            <TouchableOpacity onPress={handleCancel} className="p-1 mr-4">
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-white flex-1">Edit message</Text>
          </View>

          {/* Middle area - shows original message preview */}
          <View className="flex-1 bg-[#E5DDD5] justify-end pb-4 px-3">
            {/* Current message being edited - shown as preview */}
            <View className="self-end max-w-[75%] bg-[#DCF8C6] rounded-lg px-3 py-2 shadow-sm">
              <Text className="text-base text-black leading-[22px]">
                {message.messageText}
              </Text>
              <View className="flex-row items-center justify-end mt-1">
                <Text className="text-[11px] text-[#8E8E93]">
                  {message.isEdited ? 'edited' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Bottom Input Section */}
          <View className="bg-[#E5DDD5] pb-2 px-2">
            <View className="flex-row items-end gap-2">
              {/* Input Container */}
              <View className="flex-1 bg-white rounded-3xl shadow-sm overflow-hidden">
                <View className="flex-row items-end px-3 py-2">

                  {/* Text Input */}
                  <TextInput
                    ref={textInputRef}
                    className="flex-1 text-[17px] text-[#111B21] max-h-[120px] py-1"
                    placeholder="Message"
                    placeholderTextColor="#8696A0"
                    value={editedText}
                    onChangeText={setEditedText}
                    multiline
                    editable={!isEditing}
                    maxLength={4096}
                    textAlignVertical="center"
                    style={{ lineHeight: 22 }}
                  />
                </View>
              </View>

              {/* Tick/Check Button */}
              <TouchableOpacity
                className={`w-12 h-12 rounded-full justify-center items-center shadow-sm ${
                  isEditing ? 'bg-gray-400' : 'bg-[#1DAB61]'
                }`}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={isEditing}
              >
                {isEditing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={26} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
