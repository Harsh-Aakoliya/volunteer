import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message, ChatRoom } from '@/types/type';
import { fetchChatRooms } from '@/api/chat';

interface ForwardMessagesModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMessages: Message[];
  currentRoomId: string;
  onForward: (selectedRooms: ChatRoom[], selectedMessages: Message[]) => Promise<void>;
}

interface ForwardProgress {
  roomId: number;
  roomName: string;
  messageCount: number;
  sentCount: number;
  status: 'pending' | 'sending' | 'completed' | 'error';
}

const ForwardMessagesModal: React.FC<ForwardMessagesModalProps> = ({
  visible,
  onClose,
  selectedMessages,
  currentRoomId,
  onForward,
}) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardProgress, setForwardProgress] = useState<ForwardProgress[]>([]);

  // Load available rooms when modal opens
  useEffect(() => {
    if (visible) {
      loadRooms();
      setSelectedRooms(new Set());
      setForwardProgress([]);
    }
  }, [visible]);

  const loadRooms = async () => {
    try {
      setIsLoading(true);
      const allRooms = await fetchChatRooms();
      
      // 1. Filter out the current room entirely
      // 2. Check if user is admin (canSendMessage) for availability
      const filteredRooms = allRooms
        .filter(room => room.roomId?.toString() !== currentRoomId)
        .map(room => ({
          ...room,
          isAvailableForForwarding: room.canSendMessage === true
        }));
      
      setRooms(filteredRooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
      Alert.alert('Error', 'Failed to load chat rooms');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRoomSelection = (roomId: number) => {
    const room = rooms.find(r => r.roomId === roomId);
    
    // Only allow selection if the room is available for forwarding
    if (!room?.isAvailableForForwarding) {
      return;
    }
    
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(roomId)) {
      newSelection.delete(roomId);
    } else {
      newSelection.add(roomId);
    }
    setSelectedRooms(newSelection);
  };

  const handleForward = async () => {
    if (selectedRooms.size === 0) return;

    setIsForwarding(true);
    
    // Initialize progress tracking
    const progressData: ForwardProgress[] = Array.from(selectedRooms).map(roomId => {
      const room = rooms.find(r => r.roomId === roomId);
      return {
        roomId,
        roomName: room?.roomName || 'Unknown Room',
        messageCount: selectedMessages.length,
        sentCount: 0,
        status: 'pending' as const,
      };
    });
    
    setForwardProgress(progressData);

    try {
      const selectedRoomObjects = rooms.filter(room => 
        room.roomId && 
        selectedRooms.has(room.roomId) && 
        room.isAvailableForForwarding
      );
      
      await onForward(selectedRoomObjects, selectedMessages);
      
      // Mark all as completed
      setForwardProgress(prev => 
        prev.map(p => ({ ...p, status: 'completed', sentCount: p.messageCount }))
      );
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('Error forwarding messages:', error);
      setForwardProgress(prev => 
        prev.map(p => ({ ...p, status: 'error' }))
      );
      Alert.alert('Error', 'Failed to forward some messages');
    } finally {
      setIsForwarding(false);
    }
  };

  // Helper to get selected room names
  const getSelectedRoomNames = () => {
    return rooms
      .filter(r => r.roomId && selectedRooms.has(r.roomId))
      .map(r => r.roomName)
      .join(', ');
  };

  const renderRoomItem = ({ item }: { item: ChatRoom }) => {
    const isSelected = item.roomId ? selectedRooms.has(item.roomId) : false;
    const isAvailable = item.isAvailableForForwarding;
    
    return (
      <TouchableOpacity
        className={`p-4 border-b border-gray-100 flex-row items-center ${
          isSelected ? 'bg-blue-50' : isAvailable ? 'bg-white' : 'bg-gray-50'
        } ${!isAvailable ? 'opacity-60' : ''}`}
        onPress={() => item.roomId && toggleRoomSelection(item.roomId)}
        disabled={isForwarding || !isAvailable}
      >
        <View className={`w-12 h-12 rounded-full justify-center items-center mr-3 ${
          isAvailable ? 'bg-gray-200' : 'bg-gray-100'
        }`}>
          <Ionicons
            name={item.isGroup ? "people" : "person"}
            size={24}
            color={isAvailable ? "#54656F" : "#9ca3af"}
          />
        </View>
        
        <View className="flex-1">
          <Text className={`text-base font-semibold ${
            isAvailable ? 'text-[#111B21]' : 'text-gray-500'
          }`}>
            {item.roomName}
          </Text>
          {item.roomDescription ? (
            <Text className="text-sm text-gray-500" numberOfLines={1}>
              {item.roomDescription}
            </Text>
          ) : null}
          {!isAvailable && (
            <Text className="text-xs text-red-400 mt-0.5">
              Only admins can send messages
            </Text>
          )}
        </View>
        
        {/* Checkbox / Lock Icon */}
        <View className={`w-6 h-6 rounded-full border-2 ${
          isSelected 
            ? 'bg-[#00A884] border-[#00A884]' 
            : 'border-gray-300'
        } justify-center items-center ml-2`}>
          {isSelected && (
            <Ionicons name="checkmark" size={14} color="white" />
          )}
          {!isAvailable && !isSelected && (
            <Ionicons name="lock-closed" size={12} color="#9ca3af" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderProgressItem = ({ item }: { item: ForwardProgress }) => {
    return (
      <View className="p-3 border-b border-gray-100 flex-row items-center bg-white">
        <View className="mr-3">
          {item.status === 'sending' ? (
             <ActivityIndicator size="small" color="#00A884" />
          ) : item.status === 'completed' ? (
             <Ionicons name="checkmark-circle" size={20} color="#00A884" />
          ) : item.status === 'error' ? (
             <Ionicons name="close-circle" size={20} color="#EF4444" />
          ) : (
             <Ionicons name="time-outline" size={20} color="#6B7280" />
          )}
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">{item.roomName}</Text>
          <Text className="text-sm text-gray-500">
            {item.sentCount}/{item.messageCount} messages sent
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* Header - Styled like WhatsApp Top Bar */}
        <View className="p-4 border-b border-gray-200 bg-[#008069]">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-semibold text-white">
              Forwarding {selectedMessages.length} message{selectedMessages.length > 1 ? 's' : ''}
            </Text>
            
            <TouchableOpacity 
              onPress={onClose}
              disabled={isForwarding}
              className="p-1"
            >
              <Ionicons name="close" size={26} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress View (shown when forwarding) */}
        {isForwarding && forwardProgress.length > 0 ? (
          <View className="flex-1 bg-gray-50">
            <Text className="p-4 font-semibold text-gray-700 bg-gray-100">
              Sending...
            </Text>
            <FlatList
              data={forwardProgress}
              keyExtractor={(item) => item.roomId.toString()}
              renderItem={renderProgressItem}
            />
          </View>
        ) : (
          /* Room List */
          <View className="flex-1 relative">
            {isLoading ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#00A884" />
                <Text className="mt-2 text-gray-600">Loading chats...</Text>
              </View>
            ) : (
              <FlatList
                data={rooms}
                keyExtractor={(item) => item.roomId?.toString() || Math.random().toString()}
                renderItem={renderRoomItem}
                contentContainerStyle={{ paddingBottom: 100 }} // Add padding for footer
                ListEmptyComponent={
                  <View className="flex-1 justify-center items-center p-8 mt-10">
                    <Ionicons name="chatbubbles-outline" size={60} color="#D1D5DB" />
                    <Text className="text-gray-500 mt-4 text-center text-lg">
                      No other chats available.
                    </Text>
                  </View>
                }
              />
            )}

            {/* Bottom Footer - Only visible when rooms are selected */}
            {selectedRooms.size > 0 && !isForwarding && (
              <View className="absolute bottom-0 left-0 right-0 bg-[#F0F2F5] px-4 py-3 border-t border-gray-200 flex-row items-center justify-between z-10 shadow-lg">
                <Text 
                  numberOfLines={1} 
                  className="flex-1 text-[#111B21] mr-4 text-[15px]"
                >
                  {getSelectedRoomNames()}
                </Text>

                <TouchableOpacity
                  className="w-12 h-12 rounded-full justify-center items-center shadow-sm bg-[#1DAB61]"
                  onPress={handleForward}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default ForwardMessagesModal;