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

/**
 * ForwardMessagesModal Component
 * 
 * This component shows all available chat rooms but only allows forwarding to rooms where:
 * 1. The user is a group admin (canSendMessage = true)
 * 2. It's not the current room (where the message is from)
 * 
 * Rooms that don't meet these criteria are shown but blurred/disabled with explanatory text.
 */
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
      
      // Show all rooms but mark which ones are available for forwarding
      // A room is available if:
      // 1. It's not the current room (where the message is from)
      // 2. User is a group admin in that room (canSendMessage is true)
      const roomsWithAvailability = allRooms.map(room => {
        const isAvailable = room.roomId?.toString() !== currentRoomId && room.canSendMessage === true;
        
        return {
          ...room,
          isAvailableForForwarding: isAvailable
        };
      });
      
      setRooms(roomsWithAvailability);
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
    if (selectedRooms.size === 0) {
      Alert.alert('No Rooms Selected', 'Please select at least one room to forward messages to.');
      return;
    }

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
      // Only forward to rooms that are available for forwarding
      const selectedRoomObjects = rooms.filter(room => 
        room.roomId && 
        selectedRooms.has(room.roomId) && 
        room.isAvailableForForwarding
      );
      
      if (selectedRoomObjects.length === 0) {
        Alert.alert('No Valid Rooms', 'No valid rooms selected for forwarding.');
        return;
      }
      
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

  const updateProgress = (roomId: number, sentCount: number, status: ForwardProgress['status']) => {
    setForwardProgress(prev => 
      prev.map(p => 
        p.roomId === roomId 
          ? { ...p, sentCount, status }
          : p
      )
    );
  };

  const renderRoomItem = ({ item }: { item: ChatRoom }) => {
    const isSelected = item.roomId ? selectedRooms.has(item.roomId) : false;
    const isAvailable = item.isAvailableForForwarding;
    const isCurrentRoom = item.roomId?.toString() === currentRoomId;
    
    return (
      <TouchableOpacity
        className={`p-4 border-b border-gray-200 flex-row items-center ${
          isSelected ? 'bg-blue-50' : isAvailable ? 'bg-white' : 'bg-gray-50'
        } ${!isAvailable ? 'opacity-60' : ''}`}
        onPress={() => item.roomId && toggleRoomSelection(item.roomId)}
        disabled={isForwarding || !isAvailable}
      >
        <View className={`w-12 h-12 rounded-full justify-center items-center mr-3 ${
          isAvailable ? 'bg-blue-100' : 'bg-gray-100'
        }`}>
          <Ionicons
            name={item.isGroup ? "people" : "person"}
            size={24}
            color={isAvailable ? "#0284c7" : "#9ca3af"}
          />
        </View>
        
        <View className="flex-1">
          <Text className={`text-lg font-semibold ${
            isAvailable ? 'text-gray-800' : 'text-gray-500'
          }`}>
            {item.roomName}
            {isCurrentRoom && (
              <Text className="text-sm text-gray-400 ml-2">(Current Room)</Text>
            )}
            {!isAvailable && !isCurrentRoom && (
              <Text className="text-sm text-red-500 ml-2 font-medium">(No Send Permission)</Text>
            )}
          </Text>
          {item.roomDescription && (
            <Text className={`text-sm mt-1 ${isAvailable ? 'text-gray-500' : 'text-gray-400'}`} numberOfLines={1}>
              {item.roomDescription}
            </Text>
          )}
          {!isAvailable && !isCurrentRoom && (
            <Text className="text-xs text-gray-400 mt-1">
              You need to be a group admin to forward messages here
            </Text>
          )}
        </View>
        
        <View className={`w-6 h-6 rounded-full border-2 ${
          isSelected 
            ? 'bg-blue-500 border-blue-500' 
            : isAvailable 
              ? 'border-gray-300' 
              : 'border-gray-200'
        } justify-center items-center`}>
          {isSelected && (
            <Ionicons name="checkmark" size={16} color="white" />
          )}
          {!isAvailable && !isSelected && (
            <Ionicons name="lock-closed" size={12} color="#9ca3af" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderProgressItem = ({ item }: { item: ForwardProgress }) => {
    const getStatusIcon = () => {
      switch (item.status) {
        case 'pending':
          return <Ionicons name="time-outline" size={20} color="#6B7280" />;
        case 'sending':
          return <ActivityIndicator size="small" color="#3B82F6" />;
        case 'completed':
          return <Ionicons name="checkmark-circle" size={20} color="#10B981" />;
        case 'error':
          return <Ionicons name="close-circle" size={20} color="#EF4444" />;
      }
    };

    return (
      <View className="p-3 border-b border-gray-100 flex-row items-center">
        <View className="mr-3">
          {getStatusIcon()}
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
        {/* Header */}
        <View className="p-4 border-b border-gray-200 bg-blue-50">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <TouchableOpacity 
                onPress={onClose}
                disabled={isForwarding}
                className="mr-3"
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-gray-800">
                Forward Messages
              </Text>
            </View>
            
            {selectedRooms.size > 0 && !isForwarding && (
              <TouchableOpacity
                className="bg-blue-500 px-4 py-2 rounded-lg"
                onPress={handleForward}
              >
                <Text className="text-white font-semibold">
                  Send to {selectedRooms.size} room{selectedRooms.size > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text className="text-sm text-gray-600 mt-2">
            Forwarding {selectedMessages.length} message{selectedMessages.length > 1 ? 's' : ''}
          </Text>
          <Text className="text-xs text-gray-500 mt-1">
            Only rooms where you are a group admin are available for forwarding
          </Text>
        </View>

        {/* Progress View (shown when forwarding) */}
        {isForwarding && forwardProgress.length > 0 && (
          <View className="bg-gray-50 border-b border-gray-200">
            <Text className="p-4 font-semibold text-gray-700">
              Forwarding Progress
            </Text>
            <FlatList
              data={forwardProgress}
              keyExtractor={(item) => item.roomId.toString()}
              renderItem={renderProgressItem}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Room List */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="mt-2 text-gray-600">Loading rooms...</Text>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.roomId?.toString() || Math.random().toString()}
            renderItem={renderRoomItem}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center p-8">
                <Ionicons name="chatbubble-outline" size={60} color="#D1D5DB" />
                <Text className="text-gray-500 mt-4 text-center">
                  No rooms available to forward messages to.
                </Text>
                <Text className="text-gray-400 mt-2 text-center text-sm">
                  You need to be a group admin in other rooms to forward messages.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default ForwardMessagesModal; 