// app/chat/[id].tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/hooks/useAuth';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '../../components/chat/TypingIndicator';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { 
    currentRoom, 
    messages, 
    loadingMessages, 
    fetchMessages, 
    sendMessage, 
    chatRooms,
    setCurrentRoom,
    typingUsers,
    setTyping
  } = useChat();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
  const flatListRef = useRef(null);

  // Find the current room from chatRooms if not already set
  useEffect(() => {
    const roomId = parseInt(id as string);
    if (!currentRoom || currentRoom.id !== roomId) {
      const room = chatRooms.find(r => r.id === roomId);
      if (room) {
        setCurrentRoom(room);
      }
    }
  }, [id, chatRooms]);

  // Fetch messages when room changes
  useEffect(() => {
    if (id) {
      fetchMessages(parseInt(id as string));
    }
  }, [id]);

  // Handle typing indicators
  useEffect(() => {
    let typingTimeout;
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, []);

  const handleSend = async () => {
    if (!messageText.trim() || !user) return;
    
    try {
      setSending(true);
      setTyping(false);
      await sendMessage(messageText.trim());
      setMessageText('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (text: string) => {
    setMessageText(text);
    
    // Set typing indicator
    if (text && !sending) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  };

  const renderHeader = () => {
    if (!currentRoom) return null;
    
    return (
      <View>
        {Object.keys(typingUsers).length > 0 && (
          <TypingIndicator users={Object.values(typingUsers)} />
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View>
              <Text className="text-lg font-bold">
                {currentRoom?.display_name || 'Chat'}
              </Text>
            </View>
          ),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-2">
              <Ionicons name="arrow-back" size={24} color="#0284c7" />
            </TouchableOpacity>
          ),
        }}
      />
      
      {loadingMessages ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwnMessage={item.sender_id === user?.id}
            />
          )}
          inverted
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10 }}
        />
      )}
      
      <View className="p-2 border-t border-gray-200 bg-white">
        <View className="flex-row items-center bg-gray-100 rounded-full p-1">
          <TextInput
            ref={inputRef}
            className="flex-1 px-4 py-2 text-gray-800"
            placeholder="Type a message..."
            value={messageText}
            onChangeText={handleInputChange}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
            className={`p-2 rounded-full ${
              messageText.trim() ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}