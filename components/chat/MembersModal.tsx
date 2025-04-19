// components/chat/MembersModal.tsx
import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Member {
  userId: string;
  fullName: string;
  isAdmin: boolean;
  isOnline: boolean;
}

interface MembersModalProps {
  visible: boolean;
  onClose: () => void;
  members: Member[];
  currentUserId: string;
}

const MembersModal: React.FC<MembersModalProps> = ({ 
  visible, 
  onClose, 
  members, 
  currentUserId 
}) => {
  // Get online members
  const onlineMembers = members.filter(m => m.isOnline);
  
  // Render a member item
  const renderMemberItem = ({ item }: { item: Member }) => (
    <View className="flex-row items-center justify-between p-3 border-b border-gray-100">
      <View className="flex-row items-center">
        <View className={`w-10 h-10 rounded-full justify-center items-center mr-3 ${item.isOnline ? 'bg-green-100' : 'bg-gray-100'}`}>
          <Text className={`font-bold ${item.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
            {(item.fullName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text className={`font-bold ${item.isOnline ? 'text-black' : 'text-gray-400'}`}>
            {item.fullName || 'Unknown User'} {item.userId === currentUserId ? '(You)' : ''}
          </Text>
          <Text className={`text-xs ${item.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
            {item.isAdmin ? 'Admin • ' : ''}{item.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      
      {item.isOnline && (
        <View className="h-3 w-3 bg-green-500 rounded-full"></View>
      )}
    </View>
  );
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black bg-opacity-50">
        <View className="bg-white rounded-t-xl mt-auto h-2/3">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
            <Text className="text-lg font-bold">Room Members</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          {/* Online Members Section */}
          <View className="p-4 border-b border-gray-200">
            <Text className="font-bold text-green-600 mb-2">
              Online ({onlineMembers.length})
            </Text>
            {onlineMembers.length > 0 ? (
              onlineMembers.map(member => (
                <View key={member.userId} className="flex-row items-center mb-2">
                  <View className="w-8 h-8 bg-green-100 rounded-full justify-center items-center mr-2">
                    <Text className="text-green-600 font-bold">
                      {(member.fullName || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text>{member.fullName || 'Unknown User'}</Text>
                </View>
              ))
            ) : (
              <Text className="text-gray-500 italic">No members online</Text>
            )}
          </View>
          
          {/* All Members List */}
          <FlatList
            data={members}
            keyExtractor={(item) => item.userId}
            renderItem={renderMemberItem}
            ListHeaderComponent={
              <View className="p-4 border-b border-gray-200">
                <Text className="font-bold">All Members ({members.length})</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

export default MembersModal;