import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '@/context/ChatContext';

// Define a type for the user object
type ChatUser = {
  id: number;
  full_name: string;
  mobile_number: string;
};

export default function NewChatScreen() {
  const router = useRouter();
  const { chatUsers, fetchChatUsers, createOrGetDirectMessageRoom, createGroupRoom } = useChat();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        await fetchChatUsers();
      } finally {
        setLoading(false);
      }
    };
    
    loadUsers();
  }, []);

  const filteredUsers = chatUsers.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.mobile_number.includes(searchQuery)
  );

  const handleUserSelect = async (user: ChatUser) => {
    if (isGroupMode) {
      // Toggle selection for group chat
      if (selectedUsers.some(u => u.id === user.id)) {
        setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
      } else {
        setSelectedUsers([...selectedUsers, user]);
      }
    } else {
      // Create or get direct message
      try {
        setCreatingChat(true);
        const roomId = await createOrGetDirectMessageRoom(user.id);
        // Fix: Use proper typing for the router
        router.replace({
          pathname: `/chat/[id]`,
          params: { id: roomId.toString() }
        });
      } catch (error) {
        console.error('Error creating chat:', error);
      } finally {
        setCreatingChat(false);
      }
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    
    try {
      setCreatingChat(true);
      const roomId = await createGroupRoom(
        groupName,
        groupDescription,
        selectedUsers.map(u => u.id)
      );
      setShowGroupModal(false);
      // Fix: Use proper typing for the router
      router.replace({
        pathname: `/chat/[id]`,
        params: { id: roomId.toString() }
      });
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setCreatingChat(false);
    }
  };

  const toggleGroupMode = () => {
    setIsGroupMode(!isGroupMode);
    setSelectedUsers([]);
  };

  const renderGroupModal = () => (
    <Modal
      visible={showGroupModal}
      animationType="slide"
      transparent={true}
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="bg-white rounded-lg w-4/5 p-5">
          <Text className="text-xl font-bold mb-4">Create Group Chat</Text>
          
          <Text className="text-gray-600 mb-1">Group Name</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-2 mb-3"
            placeholder="Enter group name"
            value={groupName}
            onChangeText={setGroupName}
          />
          
          <Text className="text-gray-600 mb-1">Description (Optional)</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-2 mb-3"
            placeholder="Enter group description"
            value={groupDescription}
            onChangeText={setGroupDescription}
            multiline
          />
          
          <Text className="text-gray-600 mb-2">Selected Members: {selectedUsers.length}</Text>
          
          <View className="flex-row justify-end mt-4">
            <TouchableOpacity
              onPress={() => setShowGroupModal(false)}
              className="px-4 py-2 mr-2"
            >
              <Text className="text-gray-600">Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0 || creatingChat}
              className={`px-4 py-2 rounded-lg ${
                !groupName.trim() || selectedUsers.length === 0 || creatingChat
                  ? 'bg-gray-300'
                  : 'bg-blue-500'
              }`}
            >
              {creatingChat ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerTitle: isGroupMode ? 'New Group Chat' : 'New Chat',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-2">
              <Ionicons name="arrow-back" size={24} color="#0284c7" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={toggleGroupMode} className="mr-2">
              <Text className="text-blue-500 font-medium">
                {isGroupMode ? 'Single Chat' : 'Group Chat'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      
      <View className="p-3 border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            className="flex-1 ml-2 text-gray-800"
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isGroupMode && selectedUsers.length > 0 && (
        <View className="py-2 px-3 bg-blue-50">
          <Text className="text-blue-700 font-medium mb-2">Selected: {selectedUsers.length}</Text>
          <FlatList
            data={selectedUsers}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            renderItem={({ item }) => (
              <View className="bg-blue-100 rounded-full px-3 py-1 mr-2 flex-row items-center">
                <Text className="text-blue-700 mr-1">{item.full_name}</Text>
                <TouchableOpacity onPress={() => handleUserSelect(item)}>
                  <Ionicons name="close-circle" size={16} color="#3b82f6" />
                </TouchableOpacity>
              </View>
            )}
          />
          <TouchableOpacity
            onPress={() => setShowGroupModal(true)}
            className="bg-blue-500 py-2 rounded-lg mt-2"
          >
            <Text className="text-white font-semibold text-center">Create Group Chat</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      ) : filteredUsers.length === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-500 text-center">No users found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`flex-row items-center p-4 border-b border-gray-100 ${
                isGroupMode && selectedUsers.some(u => u.id === item.id)
                  ? 'bg-blue-50'
                  : ''
              }`}
              onPress={() => handleUserSelect(item)}
              disabled={creatingChat}
            >
              <View className="h-12 w-12 rounded-full bg-blue-100 items-center justify-center mr-3">
                <Text className="text-blue-500 font-bold text-lg">
                  {item.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">{item.full_name}</Text>
                <Text className="text-gray-500 text-sm">{item.mobile_number}</Text>
              </View>
              
              {isGroupMode && (
                <View className="h-6 w-6 border-2 rounded-full items-center justify-center mr-2 border-blue-500">
                  {selectedUsers.some(u => u.id === item.id) && (
                    <View className="h-4 w-4 bg-blue-500 rounded-full" />
                  )}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
      
      {renderGroupModal()}
    </View>
  );
}