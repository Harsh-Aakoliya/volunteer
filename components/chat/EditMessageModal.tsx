// components/chat/EditMessageModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message, ChatUser } from '@/types/type';
import MessageInput from './MessageInput';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';

interface EditMessageModalProps {
  visible: boolean;
  onClose: () => void;
  message: Message | null;
  roomId: string | number; // Add roomId as a separate prop
  roomMembers: ChatUser[];
  currentUser: {
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
  roomMembers,
  currentUser,
  onMessageEdited
}: EditMessageModalProps) {
  console.log("message to edit",message);
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (message && visible) {
      // Extract the original message text (remove mentions formatting for editing)
      const originalText = message.messageText || '';
      setEditedText(originalText);
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
      // No changes made
      onClose();
      return;
    }

    try {
      setIsEditing(true);
      const token = await AuthStorage.getToken();
      
      // Ensure we have a valid message ID and roomId
      const messageId = typeof message.id === 'string' ? message.id : String(message.id);
      const roomIdValue = String(roomId); // Use the roomId prop instead of message.roomId
      
      console.log('Editing message with ID:', messageId, 'in room:', roomIdValue);
      
      // Validate roomId before making API call
      if (!roomIdValue || roomIdValue === 'undefined' || roomIdValue === 'null') {
        throw new Error('Invalid room ID');
      }
       
       const response = await axios.put(
         `${API_URL}/api/chat/rooms/${roomIdValue}/messages/${messageId}`,
         {
           messageText: editedText.trim()
         },
         {
           headers: { Authorization: `Bearer ${token}` }
         }
       );

      // Create the updated message object
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
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-center px-4">
          <View className="bg-white rounded-lg shadow-lg max-h-96">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
              <Text className="text-lg font-bold text-gray-800">Edit Message</Text>
              <TouchableOpacity onPress={handleCancel}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Original message preview */}
            <View className="p-4 border-b border-gray-100 bg-gray-50">
              <Text className="text-sm font-medium text-gray-600 mb-1">Original message:</Text>
              <Text className="text-gray-800 italic">{message.messageText}</Text>
            </View>

            {/* Edit input */}
            <View className="border-t border-gray-200 bg-white">
              <MessageInput
                messageText={editedText}
                onChangeText={setEditedText}
                onSend={handleSave}
                placeholder="Edit your message..."
                sending={isEditing}
                disabled={isEditing}
                roomMembers={roomMembers}
                currentUser={currentUser}
                showAttachments={false}
                multiline={true}
                maxHeight={120}
                autoFocus={true}
                style={{ maxHeight: 150 }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
