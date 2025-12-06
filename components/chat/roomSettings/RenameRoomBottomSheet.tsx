// components/chat/roomSettings/RenameRoomBottomSheet.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { renameRoom } from '@/api/chat';
import { showToast } from '@/utils/toast';

interface RenameRoomBottomSheetProps {
  roomId: string;
  currentName: string;
  currentDescription?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RenameRoomBottomSheet({
  roomId,
  currentName,
  currentDescription,
  onClose,
  onSuccess,
}: RenameRoomBottomSheetProps) {
  const [roomName, setRoomName] = useState(currentName);
  const [roomDescription, setRoomDescription] = useState(currentDescription || '');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleUpdate = async () => {
    Keyboard.dismiss();

    if (!roomName.trim()) {
      Alert.alert('Error', 'Room name cannot be empty');
      return;
    }

    try {
      setIsLoading(true);
      await renameRoom(roomId, roomName.trim(), roomDescription.trim());
      showToast('Room updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error renaming room:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Instructions */}
          <View style={styles.instructionBox}>
            <Text style={styles.instructionText}>
              Update the room name and description
            </Text>
          </View>

          {/* Room Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Room Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter room name"
              placeholderTextColor="#9ca3af"
              value={roomName}
              onChangeText={setRoomName}
              maxLength={100}
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{roomName.length}/100 characters</Text>
          </View>

          {/* Room Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Enter room description"
              placeholderTextColor="#9ca3af"
              value={roomDescription}
              onChangeText={setRoomDescription}
              maxLength={500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
            />
            <Text style={styles.charCount}>{roomDescription.length}/500 characters</Text>
          </View>

          <View style={styles.scrollFooter} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          onPress={onClose}
          disabled={isLoading}
          style={styles.cancelButton}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleUpdate}
          disabled={isLoading || !roomName.trim()}
          style={[
            styles.updateButton,
            (isLoading || !roomName.trim()) && styles.updateButtonDisabled,
          ]}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.updateButtonText}>Update</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  scrollFooter: {
    height: 24,
  },
  instructionBox: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  instructionText: {
    color: '#1E40AF',
    fontSize: 14,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'right',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});