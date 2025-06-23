import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomButton from '@/components/ui/CustomButton';
import { DepartmentUser } from '@/types/type';
import { fetchAllUsers, createDepartment, checkDepartmentNameExists } from '@/api/department';

export default function CreateDepartmentPage() {
  const [departmentName, setDepartmentName] = useState('');
  const [allUsers, setAllUsers] = useState<DepartmentUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<DepartmentUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<DepartmentUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, allUsers, selectedUsers]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const users = await fetchAllUsers();
      setAllUsers(users);
    } catch (error) {
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    const selectedUserIds = selectedUsers.map(u => u.userId);
    const availableUsers = allUsers.filter(user => !selectedUserIds.includes(user.userId));
    
    if (!searchQuery.trim()) {
      setFilteredUsers(availableUsers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = availableUsers.filter(user =>
      user?.fullName?.toLowerCase().includes(query) ||
      user?.userId?.toLowerCase().includes(query) ||
      user?.mobileNumber?.includes(query)
    );
    
    setFilteredUsers(filtered);
  };

  const validateDepartmentName = async (name: string) => {
    if (!name.trim()) {
      setNameError('Department name is required');
      return false;
    }

    // if (name.trim().length < 3) {
    //   setNameError('Department name must be at least 3 characters');
    //   return false;
    // }

    try {
      const exists = await checkDepartmentNameExists(name.trim());
      if (exists) {
        setNameError('Department name already exists');
        return false;
      }
    } catch (error) {
      setNameError('Error checking department name');
      return false;
    }

    setNameError('');
    return true;
  };

  const handleSelectUser = (user: DepartmentUser) => {
    if (user.department && user.departmentId) {
      Alert.alert(
        'User Already Assigned',
        `${user.fullName} is already assigned to "${user.department}" department.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedUsers(prev => [...prev, user]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(user => user.userId !== userId));
  };

  const handleCreateDepartment = async () => {
    if (!await validateDepartmentName(departmentName)) {
      return;
    }

    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user for the department');
      return;
    }

    try {
      setIsCreating(true);
      
      const userList = selectedUsers.map(user => user.userId);
      const adminList = selectedUsers.filter(user => user.isAdmin).map(user => user.userId);

      await createDepartment({
        departmentName: departmentName.trim(),
        userList,
        adminList
      });

      Alert.alert(
        'Success',
        'Department created successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create department');
    } finally {
      setIsCreating(false);
    }
  };

  const UserItem = ({ user, isSelected = false, onPress }: {
    user: DepartmentUser;
    isSelected?: boolean;
    onPress: () => void;
  }) => {
    const isDisabled = !isSelected && !!(user.department && user.departmentId);
    
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled || false}
        className={`p-4 border-b border-gray-100 ${isDisabled ? 'opacity-50' : ''}`}
      >
        <View className="flex-row items-center">
          <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
            <Text className="text-blue-600 font-semibold">
              {user?.fullName?.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          <View className="flex-1">
            <Text className="font-semibold text-gray-800">{user.fullName}</Text>
            <Text className="text-gray-500 text-sm">{user.mobileNumber}</Text>
            {user.department && (
              <Text className="text-orange-500 text-xs">
                Department: {user.department}
              </Text>
            )}
          </View>

          <View className="items-end">
            {user.isAdmin && (
              <View className="bg-green-100 px-2 py-1 rounded mb-1">
                <Text className="text-green-600 text-xs font-medium">Admin</Text>
              </View>
            )}
            
            {isSelected ? (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            ) : isDisabled ? (
              <Ionicons name="lock-closed" size={20} color="#6B7280" />
            ) : (
              <Ionicons name="add-circle-outline" size={24} color="#0286ff" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0286ff" />
        <Text className="text-gray-600 mt-2">Loading users...</Text>
      </View>
    );
  }

  const unassignedUsers = filteredUsers.filter(user => !user.department);
  const assignedUsers = filteredUsers.filter(user => user.department);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient colors={['#0286ff', '#0255ff']} className="pt-14 pb-6 px-6">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-white">Create Department</Text>
        </View>
      </LinearGradient>

      <ScrollView className="flex-1">
        {/* Department Name */}
        <View className="bg-white p-6 mb-2">
          <Text className="text-lg font-bold text-gray-800 mb-3">Department Name</Text>
          <TextInput
            value={departmentName}
            onChangeText={setDepartmentName}
            onBlur={() => validateDepartmentName(departmentName)}
            placeholder="Enter department name"
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800"
          />
          {nameError ? (
            <Text className="text-red-500 text-sm mt-1">{nameError}</Text>
          ) : null}
        </View>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <View className="bg-white p-6 mb-2">
            <Text className="text-lg font-bold text-gray-800 mb-3">
              Selected Users ({selectedUsers.length})
            </Text>
            {selectedUsers.map((user) => (
              <UserItem
                key={user.userId}
                user={user}
                isSelected={true}
                onPress={() => handleRemoveUser(user.userId)}
              />
            ))}
          </View>
        )}

        {/* Search */}
        <View className="bg-white p-6 mb-2">
          <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3">
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, ID, or mobile"
              className="flex-1 ml-3 text-gray-800"
            />
          </View>
        </View>

        {/* Available Users */}
        {unassignedUsers.length > 0 && (
          <View className="bg-white mb-2">
            <View className="p-6 pb-3">
              <Text className="text-lg font-bold text-gray-800">
                Available Users ({unassignedUsers.length})
              </Text>
            </View>
            {unassignedUsers.map((user) => (
              <UserItem
                key={user.userId}
                user={user}
                onPress={() => handleSelectUser(user)}
              />
            ))}
          </View>
        )}

        {/* Assigned Users */}
        {assignedUsers.length > 0 && (
          <View className="bg-white mb-2">
            <View className="p-6 pb-3">
              <Text className="text-lg font-bold text-gray-800">
                Already Assigned ({assignedUsers.length})
              </Text>
            </View>
            {assignedUsers.map((user) => (
              <UserItem
                key={user.userId}
                user={user}
                onPress={() => {}}
              />
            ))}
          </View>
        )}

        {/* Create Button */}
        <View className="p-6">
          <CustomButton
            title={isCreating ? 'Creating...' : 'Create Department'}
            onPress={handleCreateDepartment}
            disabled={isCreating || selectedUsers.length === 0 || !departmentName.trim()}
            loading={isCreating}
            bgVariant="primary"
            className="h-14 rounded-xl"
          />
        </View>
      </ScrollView>
    </View>
  );
} 