// app/search-users.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';

export default function SearchUsersScreen() {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all users
  const fetchAllUsers = async () => {
    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/users/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);
        setFilteredUsers(users);
      } else {
        Alert.alert('Error', 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  // Search users
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredUsers(allUsers);
    } else {
      const filtered = allUsers.filter(user => 
        user.fullName?.toLowerCase().includes(query.toLowerCase()) ||
        user.mobileNumber?.includes(query)
      );
      setFilteredUsers(filtered);
    }
  };

  // Handle edit user
  const handleEditUser = (user: any) => {
    router.push({
      pathname: '/edit-user',
      params: { userData: JSON.stringify(user) }
    });
  };

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const renderUserItem = ({ item }: { item: any }) => (
    <View className="bg-white mx-4 mb-2 rounded-lg p-4 border border-gray-200">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <Text className="text-lg font-semibold text-gray-800">{item.fullName}</Text>
            {item.isAdmin && (
              <View className="ml-2 bg-blue-100 px-2 py-1 rounded-full">
                <Text className="text-xs font-bold text-blue-600">ADMIN</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-600 mb-1">📞 {item.mobileNumber}</Text>
          <Text className="text-gray-600 mb-1">🆔 {item.userId}</Text>
          <Text className="text-gray-600">{item.department || 'No Department'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleEditUser(item)}
          className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center"
        >
          <Ionicons name="create-outline" size={20} color="#0286ff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#666" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Search Users</Text>
        <View className="w-6" />
      </View>
      
      {/* Search Bar */}
      <View className="p-4">
        <View className="flex-row items-center bg-white rounded-lg px-4 py-3 border border-gray-200">
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            placeholder="Search by name or mobile number..."
            className="flex-1 ml-3 text-gray-800"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Loading State */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      ) : (
        /* Users List */
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.userId}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-8">
              <Ionicons name="person-outline" size={60} color="#d1d5db" />
              <Text className="text-gray-500 mt-4 text-center">
                {searchQuery ? 'No users found matching your search' : 'No users available'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
} 