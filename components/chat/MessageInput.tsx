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
  Pressable,
  StyleSheet,  // ADD THIS
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
const styles = StyleSheet.create({
  // Input Bar Container
  inputBarContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 120,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 16,
    lineHeight: 20,
    color: '#000',
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: 100,
  },
  
  // Right Buttons
  rightButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconButton: {
    padding: 8,
  },
  attachButton: {
    padding: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  
  // Attachments Container
  attachmentsContainer: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    paddingTop: 8,
  },
  
  // Mention Menu
  mentionContainer: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  mentionMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  mentionScrollView: {
    maxHeight: 180,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mentionItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mentionAvatarText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  mentionName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginLeft: 8,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Schedule Menu
  scheduleMenu: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 20,
    width: '85%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  scheduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  scheduleOptionLast: {
    borderBottomWidth: 0,
  },
  scheduleOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scheduleOptionIconText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  scheduleOptionText: {
    fontSize: 16,
    color: '#000',
  },
  
  // Date Picker Modal
  datePickerModal: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 20,
    padding: 20,
    width: '85%',
    maxWidth: 320,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 20,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 16,
  },
  datePickerCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  datePickerCancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  datePickerConfirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  datePickerConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  datePickerConfirmTextDisabled: {
    color: '#B0B0B0',
  },
});

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
    <View style={styles.mentionMenu}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        style={styles.mentionScrollView}
      >
        {filteredMembers.map((member, index) => (
          <TouchableOpacity
            key={member.userId}
            onPress={() => selectMention(member)}
            style={[
              styles.mentionItem,
              index < filteredMembers.length - 1 && styles.mentionItemBorder
            ]}
          >
            <View style={styles.mentionAvatar}>
              <Text style={styles.mentionAvatarText}>
                {member.fullName?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={styles.mentionName}>{member.fullName}</Text>
            {member.isOnline && (
              <View style={styles.onlineIndicator} />
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
    <View>
      {/* Mention Menu - Positioned above input */}
      {showMentionMenu && (
        <View style={styles.mentionContainer}>
          {renderMentionMenu()}
        </View>
      )}
      
      {/* Main Input Container */}
      <View style={[styles.inputBarContainer, style]}>
        <View style={styles.inputRow}>
          {/* Text Input Container */}
          <View style={styles.inputWrapper}>
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder={placeholder}
              placeholderTextColor="#8E8E93"
              value={messageText}
              onChangeText={handleTextChange}
              onSelectionChange={handleSelectionChange}
              multiline={multiline}
              onFocus={handleInputFocus}
              onBlur={onBlur}
              editable={!disabled}
              maxLength={4096}
            />
          </View>
          
          {/* Right side - Attachment or Send button */}
          <View style={styles.rightButtonsContainer}>
            {messageText.trim().length === 0 ? (
              <>
                {/* Schedule indicator */}
                {hasScheduledMessages && (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onScheduleMessage}
                  >
                    <Ionicons name="time-outline" size={22} color="#8E8E93" />
                  </TouchableOpacity>
                )}
                
                {/* Attachments button */}
                {showAttachments && (
                  <TouchableOpacity
                    style={styles.attachButton}
                    onPress={toggleAttachmentsGrid}
                  >
                    <Ionicons 
                      name={showAttachmentsGrid ? "close" : "attach"} 
                      size={24} 
                      color={showAttachmentsGrid ? "#FF3B30" : "#8E8E93"} 
                      style={showAttachmentsGrid ? undefined : { transform: [{ rotate: '45deg' }] }}
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              /* Send button when there's text */
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!messageText.trim() || sending || disabled) && styles.sendButtonDisabled
                ]}
                onPress={() => {
                  if (!isLongPressActive) handleSend();
                }}
                onPressIn={handleLongPressStart}
                onPressOut={handleLongPressEnd}
                disabled={!messageText.trim() || sending || disabled}
                activeOpacity={0.7}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
  
        {/* Attachments Grid */}
        {showAttachmentsGrid && showAttachments && roomId && (
          <View style={styles.attachmentsContainer}>
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
          style={styles.modalOverlay}
          onPress={() => setShowScheduleMenu(false)}
        >
          <View style={styles.scheduleMenu}>
            <TouchableOpacity
              style={styles.scheduleOption}
              onPress={() => handleScheduleOption(30)}
            >
              <View style={styles.scheduleOptionIcon}>
                <Text style={styles.scheduleOptionIconText}>30m</Text>
              </View>
              <Text style={styles.scheduleOptionText}>Send in 30 minutes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.scheduleOption}
              onPress={() => handleScheduleOption(120)}
            >
              <View style={styles.scheduleOptionIcon}>
                <Text style={styles.scheduleOptionIconText}>2h</Text>
              </View>
              <Text style={styles.scheduleOptionText}>Send in 2 hours</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.scheduleOption}
              onPress={() => handleScheduleOption(480)}
            >
              <View style={styles.scheduleOptionIcon}>
                <Text style={styles.scheduleOptionIconText}>8h</Text>
              </View>
              <Text style={styles.scheduleOptionText}>Send in 8 hours</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.scheduleOption}
              onPress={() => handleScheduleOption(525600)}
            >
              <View style={styles.scheduleOptionIcon}>
                <Text style={styles.scheduleOptionIconText}>1y</Text>
              </View>
              <Text style={styles.scheduleOptionText}>Send in 1 year</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.scheduleOption, styles.scheduleOptionLast]}
              onPress={handleScheduleAtSpecificTime}
            >
              <View style={styles.scheduleOptionIcon}>
                <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
              </View>
              <Text style={styles.scheduleOptionText}>Send at specific date...</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <Text style={styles.datePickerTitle}>Schedule Message</Text>
            
            <DateTimePicker
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedTime={selectedTime}
              setSelectedTime={setSelectedTime}
              containerClassName="mb-6"
            />
            
            <View style={styles.datePickerButtons}>
              <TouchableOpacity
                style={styles.datePickerCancelButton}
                onPress={handleDateTimeCancel}
              >
                <Text style={styles.datePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.datePickerConfirmButton}
                onPress={handleDateTimeConfirm}
                disabled={!selectedDate || !selectedTime}
              >
                <Text style={[
                  styles.datePickerConfirmText,
                  (!selectedDate || !selectedTime) && styles.datePickerConfirmTextDisabled
                ]}>
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
