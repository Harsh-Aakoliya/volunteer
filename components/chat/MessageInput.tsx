// components/chat/MessageInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatUser } from '@/types/type';
import AttachmentsGrid from '@/app/chat/Attechments-grid';
import DateTimePicker from './DateTimePicker';

interface MentionSegment {
  text: string;
  isMention: boolean;
  userId?: string;
  isCurrentUser?: boolean;
}

interface MessageInputProps {
  messageText: string;
  onChangeText: (text: string) => void;
  onSend: (text: string, messageType: string, scheduledAt?: string) => void;
  placeholder?: string;
  sending?: boolean;
  disabled?: boolean;
  roomMembers?: ChatUser[];
  currentUser?: {
    userId: string;
    fullName: string | null;
  } | null;
  roomId?: string;
  showAttachments?: boolean;
  multiline?: boolean;
  maxHeight?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  style?: any;
  onAudioRecord?: () => void;
  onScheduleMessage?: () => void;
  hasScheduledMessages?: boolean;
}

export default function MessageInput({
  messageText,
  onChangeText,
  onSend,
  placeholder = "Type a message...",
  sending = false,
  disabled = false,
  roomMembers = [],
  currentUser = null,
  roomId,
  showAttachments = true,
  multiline = true,
  maxHeight,
  onFocus,
  onBlur,
  autoFocus = false,
  style,
  onAudioRecord,
  onScheduleMessage,
  hasScheduledMessages = false
}: MessageInputProps) {
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [filteredMembers, setFilteredMembers] = useState<ChatUser[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showAttachmentsGrid, setShowAttachmentsGrid] = useState(false);
  
  // Scheduling states
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const textInputRef = useRef<TextInput>(null);

  const [isLongPressActive, setIsLongPressActive] = useState(false);

  // Auto focus effect
  useEffect(() => {
    if (autoFocus && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  // Handle attachments grid toggle
  const toggleAttachmentsGrid = () => {
    // Simply toggle the attachments grid without affecting keyboard
    setShowAttachmentsGrid(!showAttachmentsGrid);
  };

  // Handle mention functionality
  const handleTextChange = (text: string) => {
    onChangeText(renderMessageText(text).join(""));
    
    // Find the last @ symbol before cursor position
    const beforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Check if there's a space after the @ symbol and before cursor
      const afterAt = beforeCursor.substring(lastAtIndex + 1);
      const hasSpaceAfterAt = afterAt.includes(' ');
      
      if (!hasSpaceAfterAt) {
        // Extract the search term after @
        const searchTerm = afterAt.toLowerCase();
        setMentionSearch(searchTerm);
        setMentionStartIndex(lastAtIndex);
        
        // Filter members based on search term (show all if searchTerm is empty)
        const filtered = roomMembers.filter(member => 
          searchTerm === '' || member.fullName?.toLowerCase().startsWith(searchTerm) || false
        );
        
        setFilteredMembers(filtered);
        setShowMentionMenu(filtered.length > 0);
      } else {
        setShowMentionMenu(false);
      }
    } else {
      setShowMentionMenu(false);
    }
  };

  const handleSelectionChange = (event: any) => {
    setCursorPosition(event.nativeEvent.selection.start);
  };

  const selectMention = (member: ChatUser) => {
    if (mentionStartIndex === -1 || !member.fullName) return;
    console.log(mentionStartIndex);
    const beforeMention = messageText.substring(0, mentionStartIndex);
    const afterMention = messageText.substring(mentionStartIndex + mentionSearch.length + 1);
    console.log("before mention", beforeMention);
    console.log("after mention", afterMention);
    const newText = `${beforeMention.slice(0, -1)}<Text>${member.fullName}</Text> ${afterMention}`;
    onChangeText(renderMessageText(newText).join(""));
    setShowMentionMenu(false);
    
    // Set cursor position after the mention
    const newCursorPosition = mentionStartIndex + member.fullName.length + 13;
    setTimeout(() => {
      setCursorPosition(newCursorPosition);
      textInputRef.current?.setNativeProps({
        selection: { start: newCursorPosition, end: newCursorPosition }
      });
    }, 10);
  };

  // Parse message text to identify mentions
  const parseMessageText = (text: string): MentionSegment[] => {
    const segments: MentionSegment[] = [];
    const mentionRegex = /<Text>([^<]+)<\/Text>/g;
    let lastIndex = 0;
    let match: any;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, match.index),
          isMention: false
        });
      }

      // Check if mentioned user exists in room members
      const mentionedUser = roomMembers.find(member => 
        member.fullName?.toLowerCase() === match[1].toLowerCase()
      );

      if (mentionedUser) {
        // Add mention segment with @ symbol
        segments.push({
          text: `@${match[1]}`,
          isMention: true,
          userId: mentionedUser.userId,
          isCurrentUser: mentionedUser.userId === currentUser?.userId
        });
      } else {
        // Add as normal text if user doesn't exist
        segments.push({
          text: `@${match[1]}`,
          isMention: false
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isMention: false
      });
    }

    return segments;
  };

  // Render mention menu
  const renderMentionMenu = () => {
    if (!showMentionMenu || filteredMembers.length === 0) return null;

    return (
      <View className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 mb-2">
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filteredMembers.map((member) => (
            <TouchableOpacity
              key={member.userId}
              onPress={() => selectMention(member)}
              className="p-3 border-b border-gray-100 flex-row items-center"
            >
              <View className="w-8 h-8 bg-blue-500 rounded-full justify-center items-center mr-3">
                <Text className="text-white font-bold text-sm">
                  {member.fullName?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <Text className="text-gray-800 font-medium">{member.fullName}</Text>
              {member.isOnline && (
                <View className="w-2 h-2 bg-green-500 rounded-full ml-auto" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Render whatever user is writing in text input box
  const renderMessageText = (text: string) => {
    const segments = parseMessageText(text);
    
    return (
      segments.map((segment, index) => (
        segment.isMention ? "@" + segment.text : segment.text
      ))
    );
  };

  const handleSend = (scheduledAt?: string) => {
    if (messageText.trim() && !sending && !disabled) {
      onSend(messageText, "text", scheduledAt);
    }
  };

  const handleInputFocus = () => {
    // Keep attachments grid visible when input is focused
    onFocus && onFocus();
  };

  // Scheduling functions
  const handleLongPressStart = () => {
    if (messageText.trim() && !sending && !disabled) {
      const timer = setTimeout(() => {
        setIsLongPressActive(true);
        setShowScheduleMenu(true);
      }, 500); // 500ms long press
      setLongPressTimer(timer);
    }
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressActive(false);

  };

  const handleScheduleOption = (minutes: number) => {
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + minutes * 60 * 1000);
    const scheduledAt = scheduledTime.toISOString();
    
    setShowScheduleMenu(false);
    handleSend(scheduledAt);
  };

  const handleScheduleAtSpecificTime = () => {
    setShowScheduleMenu(false);
    setShowDateTimePicker(true);
  };

  const handleDateTimeConfirm = () => {
    if (selectedDate && selectedTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      // Check if the selected time is in the future
      if (scheduledDateTime > new Date()) {
        const scheduledAt = scheduledDateTime.toISOString();
        setShowDateTimePicker(false);
        setSelectedDate(null);
        setSelectedTime(null);
        handleSend(scheduledAt);
      } else {
        alert('Please select a future date and time');
      }
    }
  };

  const handleDateTimeCancel = () => {
    setShowDateTimePicker(false);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  return (
    <View style={style}>
      {/* Mention Menu */}
      {showMentionMenu && (
        <View className="px-4 pb-2">
          {renderMentionMenu()}
        </View>
      )}
      
      {/* Main Input Container - Telegram-like design */}
      <View className="bg-white">
        <View className="flex-row items-end">
          {/* Emoji button - always on the left */}
          {/* <TouchableOpacity
            className="mr-3 pb-1"
            onPress={() => {
              // TODO: Implement emoji picker
              alert("Emoji picker will be implemented in the next release");
            }}
          >
            <Ionicons name="happy-outline" size={24} color="#6b7280" />
          </TouchableOpacity> */}
          
          {/* Text Input */}
          <View className="flex-1 bg-gray-100 rounded-lg px-4 py-2 min-h-[40px] max-h-[120px]">
            <TextInput
              ref={textInputRef}
              className="text-base text-gray-900"
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              value={messageText}
              onChangeText={handleTextChange}
              onSelectionChange={handleSelectionChange}
              multiline={multiline}
              onFocus={handleInputFocus}
              onBlur={onBlur}
              editable={!disabled}
              style={maxHeight ? { maxHeight } : undefined}
            />
          </View>
          
          {/* Right side icons */}
          {messageText.trim().length === 0 ? (
            <View className="flex-row items-center ml-3">
              {/* Schedule button - show if there are scheduled messages */}
              {hasScheduledMessages && (
                <TouchableOpacity
                  className="mr-3 pb-1"
                  onPress={onScheduleMessage}
                >
                  <Ionicons name="time-outline" size={24} color="#6b7280" />
                </TouchableOpacity>
              )}
              
              {/* Camera button */}
              {/* <TouchableOpacity
                className="mr-3 pb-1"
                onPress={() => {
                  // TODO: Implement in next release
                  alert("Camera functionality will be implemented in the next release");
                }}
              >
                <Ionicons name="camera-outline" size={24} color="#6b7280" />
              </TouchableOpacity> */}
              
              {/* Attachments button */}
              {showAttachments && (
                <TouchableOpacity
                  className="mr-3 pb-1.5"
                  onPress={toggleAttachmentsGrid}
                >
                  <Ionicons 
                    name={showAttachmentsGrid ? "close-circle" : "add-circle-outline"} 
                    size={30} 
                    color={showAttachmentsGrid ? "#ef4444" : "#6b7280"} 
                  />
                </TouchableOpacity>
              )}
              
              {/* Microphone button */}
              {/* <TouchableOpacity
                className="pb-1"
                onPress={() => {
                  // This will trigger audio recording - handled by parent component
                  if (onSend) {
                    onSend("", "audio");
                  }
                }}
              >
                <Ionicons name="mic-outline" size={24} color="#6b7280" />
              </TouchableOpacity> */}
            </View>
          ) : (
            <View className="ml-3">
              {/* Send button when typing */}
              <TouchableOpacity
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  messageText.trim() && !sending && !disabled
                    ? "bg-blue-500"
                    : "bg-gray-300"
                }`}
                onPress={() => {
                  if (!isLongPressActive) handleSend();
                }}
                onPressIn={handleLongPressStart}
                onPressOut={handleLongPressEnd}
                disabled={!messageText.trim() || sending || disabled}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Attachments Grid */}
        {showAttachmentsGrid && showAttachments && roomId && (
          <View className="mt-2">
            <AttachmentsGrid 
              roomId={roomId} 
              userId={currentUser?.userId || ""} 
              onOptionSelect={() => setShowAttachmentsGrid(false)}
              onAudioRecord={onAudioRecord}
            />
          </View>
        )}
      </View>

      {/* Schedule Menu Modal */}
      <Modal
        visible={showScheduleMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScheduleMenu(false)}
      >
        <Pressable 
          className="flex-1 justify-center items-center bg-black/20"
          onPress={() => setShowScheduleMenu(false)}
        >
          <View className="bg-white rounded-2xl mx-4 shadow-lg overflow-hidden">
            <TouchableOpacity
              className="px-6 py-4 border-b border-gray-100"
              onPress={() => handleScheduleOption(30)}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-4">
                  <Text className="text-gray-600 font-medium text-xs">30m</Text>
                </View>
                <Text className="text-gray-900 text-base">Send in 30 minutes</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="px-6 py-4 border-b border-gray-100"
              onPress={() => handleScheduleOption(120)}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-4">
                  <Text className="text-gray-600 font-medium text-xs">2h</Text>
                </View>
                <Text className="text-gray-900 text-base">Send in 2 hours</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="px-6 py-4 border-b border-gray-100"
              onPress={() => handleScheduleOption(480)}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-4">
                  <Text className="text-gray-600 font-medium text-xs">8h</Text>
                </View>
                <Text className="text-gray-900 text-base">Send in 8 hours</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="px-6 py-4 border-b border-gray-100"
              onPress={() => handleScheduleOption(525600)}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-4">
                  <Text className="text-gray-600 font-medium text-xs">1y</Text>
                </View>
                <Text className="text-gray-900 text-base">Send in 1 year</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="px-6 py-4"
              onPress={handleScheduleAtSpecificTime}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-4">
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                </View>
                <Text className="text-gray-900 text-base">Send at specific date...</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Date Time Picker Modal */}
      <Modal
        visible={showDateTimePicker}
        transparent
        animationType="slide"
        onRequestClose={handleDateTimeCancel}
      >
        <View className="flex-1 justify-center items-center bg-black/20">
          <View className="bg-white rounded-2xl mx-4 p-6 w-80">
            <Text className="text-lg font-semibold text-gray-900 mb-4 text-center">
              Schedule Message
            </Text>
            
            <DateTimePicker
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedTime={selectedTime}
              setSelectedTime={setSelectedTime}
              containerClassName="mb-6"
            />
            
            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity
                className="px-4 py-2"
                onPress={handleDateTimeCancel}
              >
                <Text className="text-gray-600 text-base">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="px-4 py-2"
                onPress={handleDateTimeConfirm}
                disabled={!selectedDate || !selectedTime}
              >
                <Text className={`text-base font-medium ${
                  selectedDate && selectedTime ? 'text-blue-500' : 'text-gray-400'
                }`}>
                  Schedule
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
