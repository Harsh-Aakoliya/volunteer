// components/chat/MessageInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatUser } from '@/types/type';
import AttachmentsGrid from '@/app/(tabs)/chat/Attechments-grid';

interface MentionSegment {
  text: string;
  isMention: boolean;
  userId?: string;
  isCurrentUser?: boolean;
}

interface MessageInputProps {
  messageText: string;
  onChangeText: (text: string) => void;
  onSend: (text: string, messageType: string) => void;
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
  onAudioRecord
}: MessageInputProps) {
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [filteredMembers, setFilteredMembers] = useState<ChatUser[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showAttachmentsGrid, setShowAttachmentsGrid] = useState(false);

  const textInputRef = useRef<TextInput>(null);

  // Auto focus effect
  useEffect(() => {
    if (autoFocus && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  // Handle keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        if (showAttachmentsGrid) {
          setShowAttachmentsGrid(false);
        }
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
    };
  }, [showAttachmentsGrid]);

  // Handle attachments grid toggle
  const toggleAttachmentsGrid = () => {
    if (showAttachmentsGrid) {
      // Hide attachments grid and show keyboard
      setShowAttachmentsGrid(false);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    } else {
      // Show attachments grid and hide keyboard
      Keyboard.dismiss();
      setShowAttachmentsGrid(true);
    }
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

  const handleSend = () => {
    if (messageText.trim() && !sending && !disabled) {
      onSend(messageText, "text");
    }
  };

  const handleInputFocus = () => {
    if (showAttachmentsGrid) {
      setShowAttachmentsGrid(false);
    }
    onFocus && onFocus();
  };

  return (
    <View style={style}>
      {/* Mention Menu */}
      {showMentionMenu && (
        <View className="p-2">
          {renderMentionMenu()}
        </View>
      )}
      
      
      <View className="flex-row items-center p-2">
        {/* Input Bar - always present */}
        <TextInput
          ref={textInputRef}
          className="flex-1 bg-gray-100 rounded-lg px-4 py-2 mx-2"
          placeholder={placeholder}
          value={messageText}
          onChangeText={handleTextChange}
          onSelectionChange={handleSelectionChange}
          multiline={multiline}
          onFocus={handleInputFocus}
          onBlur={onBlur}
          editable={!disabled}
          style={maxHeight ? { maxHeight } : undefined}
        />
        {/* Telegram-like UI: Show 3 icons when empty, send icon when typing */}
        {messageText.trim().length === 0 ? (
          <>
            {/* Camera button */}
            <TouchableOpacity
              className="p-2 mr-2"
              onPress={() => {
                // TODO: Implement in next release
                alert("Camera functionality will be implemented in the next release");
              }}
            >
              <Ionicons name="camera" size={24} color="#6b7280" />
            </TouchableOpacity>
            
            {/* Attachments button */}
            {showAttachments && (
              <TouchableOpacity
                className="p-2 mr-2"
                onPress={toggleAttachmentsGrid}
              >
                <Ionicons 
                  name={showAttachmentsGrid ? "close-circle" : "add-circle"} 
                  size={24} 
                  color={showAttachmentsGrid ? "#ef4444" : "#6b7280"} 
                />
              </TouchableOpacity>
            )}
            
            {/* Microphone button */}
            <TouchableOpacity
              className="p-2"
              onPress={() => {
                // This will trigger audio recording - handled by parent component
                if (onSend) {
                  onSend("", "audio");
                }
              }}
            >
              <Ionicons name="mic" size={24} color="#6b7280" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Send button when typing */}
            <TouchableOpacity
              className={`rounded-full p-2 ml-auto ${
                messageText.trim() && !sending && !disabled
                  ? "bg-blue-500"
                  : "bg-gray-300"
              }`}
              onPress={handleSend}
              disabled={!messageText.trim() || sending || disabled}
            >
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={24} color="white" />
              )}
            </TouchableOpacity>
          </>
        )}
        
        
      </View>

      {/* Attachments Grid */}
      {showAttachmentsGrid && showAttachments && roomId && (
        <View className="border-t border-gray-200 bg-gray-50 p-4">
          <AttachmentsGrid 
            roomId={roomId} 
            userId={currentUser?.userId || ""} 
            onOptionSelect={() => setShowAttachmentsGrid(false)}
            onAudioRecord={onAudioRecord}
          />
        </View>
      )}
    </View>
  );
}
