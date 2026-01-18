import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AttachmentsGrid from '@/app/chat/Attechments-grid';
import DateTimePicker from './DateTimePicker';
import { ChatUser, Message } from '@/types/type';
interface MessageInputProps { messageText: string; onChangeText: (text: string) => void; onSend: (text: string, messageType: string, mediafilesId: number, tableId: number, pollId: number, scheduledAt?: string) => void; placeholder?: string; sending?: boolean; disabled?: boolean; roomMembers?: ChatUser[]; currentUser?: { userId: string; fullName: string | null; } | null; roomId?: string; showAttachments?: boolean; multiline?: boolean; onFocus?: () => void; onBlur?: () => void; autoFocus?: boolean; onAudioRecord?: () => void; onScheduleMessage?: () => void; hasScheduledMessages?: boolean; replyToMessage?: Message | null; onCancelReply?: () => void; }
export default function MessageInput({
  messageText,
  onChangeText,
  onSend,
  placeholder = 'Message',
  sending = false,
  disabled = false,
  roomMembers = [],
  currentUser,
  roomId,
  showAttachments = true,
  multiline = true,
  onFocus,
  onBlur,
  replyToMessage,
  onCancelReply,
}: MessageInputProps) {

  /* ---------------- STATE ---------------- */
  const [showAttachmentsGrid, setShowAttachmentsGrid] = useState(false);

  /* ---------------- REFS ---------------- */
  const inputRef = useRef<TextInput>(null);
  const gridAnim = useRef(new Animated.Value(0)).current;
  const plusAnim = useRef(new Animated.Value(0)).current;

  /* ---------------- KEYBOARD ---------------- */
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // ❗ INTENTIONALLY EMPTY
      // keyboard should NOT affect grid
    });
    return () => sub.remove();
  }, []);

  /* ---------------- REPLY OVERRIDE ---------------- */
  useEffect(() => {
    if (replyToMessage && showAttachmentsGrid) {
      closeGrid();
    }
  }, [replyToMessage]);

  /* ---------------- ANIMATION ---------------- */
  const openGrid = () => {
    setShowAttachmentsGrid(true);
    Animated.parallel([
      Animated.timing(gridAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(plusAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeGrid = () => {
    Animated.parallel([
      Animated.timing(gridAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(plusAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setShowAttachmentsGrid(false));
  };

  const gridTranslateY = gridAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [180, 0], // REAL slide
  });

  const plusRotate = plusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  /* ---------------- ACTION ---------------- */
  const isEmpty = messageText.trim().length === 0;

  const handleActionPress = () => {
    if (!isEmpty) {
      onSend(messageText, 'text', 0, 0, 0);
      closeGrid();
      return;
    }

    if (replyToMessage) return; // ❌ blocked

    showAttachmentsGrid ? closeGrid() : openGrid();
  };

  /* ---------------- INPUT CHANGE ---------------- */
  const handleTextChange = (text: string) => {
    onChangeText(text);
    if (text.length > 0 && showAttachmentsGrid) {
      closeGrid();
    }
  };

  /* ---------------- RENDER ---------------- */
  return (
    <View className="bg-transparent">

      {/* ===== ATTACHMENT GRID (PUSHES INPUT) ===== */}
      <View className="px-2">

      {!replyToMessage && showAttachmentsGrid && showAttachments && roomId && (
        <Animated.View
        style={{ transform: [{ translateY: gridTranslateY }] }}
        className="bg-[#F0F2F5] border-t border-gray-200 rounded-2xl"
        >
          <AttachmentsGrid
            roomId={roomId}
            userId={currentUser?.userId ?? ""}
            onOptionSelect={closeGrid}
            />
        </Animated.View>
      )}
      </View>

      {/* ===== INPUT ROW ===== */}
      <View className="flex-row items-end px-2 py-1">

        <View className="flex-1 bg-white rounded-[22px] mr-1.5 border border-gray-100">

          {/* REPLY PREVIEW */}
          {replyToMessage && (
            <View className="mx-2 mt-2 p-2 bg-[#F0F2F5] rounded-[12px] border-l-4 border-[#00A884] flex-row justify-between">
              <View className="flex-1">
                <Text className="text-[#00A884] text-xs font-bold">
                  {replyToMessage.senderId === currentUser?.userId ? 'You' : replyToMessage.senderName}
                </Text>
                <Text className="text-gray-500 text-xs" numberOfLines={1}>
                  {replyToMessage.messageText}
                </Text>
              </View>
              <TouchableOpacity onPress={onCancelReply}>
                <Ionicons name="close" size={14} />
              </TouchableOpacity>
            </View>
          )}

          <TextInput
            ref={inputRef}
            value={messageText}
            onChangeText={handleTextChange}
            placeholder={placeholder}
            multiline
            className="px-3 py-2 text-[17px]"
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </View>

        <TouchableOpacity
          onPress={handleActionPress}
          className="w-12 h-12 rounded-full bg-[#1DAB61] justify-center items-center"
        >
          {isEmpty ? (
            <Animated.View style={{ transform: [{ rotate: plusRotate }] }}>
              <Ionicons name="add" size={30} color="#fff" />
            </Animated.View>
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
