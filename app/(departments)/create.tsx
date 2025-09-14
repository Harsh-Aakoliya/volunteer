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
import { AuthStorage } from '@/utils/authStorage';
export default function CreateDepartmentPage() {
  const [departmentName, setDepartmentName] = useState('');
  const [allUsers, setAllUsers] = useState<DepartmentUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<DepartmentUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<DepartmentUser[]>([]);
  // const [selectedHODs, setSelectedHODs] = useState<DepartmentUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isKaryalay, setIsKaryalay] = useState(false);

  useEffect(() => {
    loadUsers();
    checkUserRole();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, allUsers, selectedUsers]);

  const checkUserRole = async () => {
    try {
      const user = await AuthStorage.getUser();
      console.log("user in checkUserRole", user);
      const userDepartments = user?.departments?.filter(Boolean);
      setIsKaryalay(Boolean(user?.isAdmin && userDepartments?.includes('Karyalay')));
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

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
    
    // Only show users who don't have any department assignments and are not already selected
    const availableUsers = allUsers.filter(user => {
      const isAlreadySelected = selectedUserIds.includes(user.userId);
      const hasNoDepartments = (!user.departments || user.departments.length === 0) && 
                              (!user.departmentIds || user.departmentIds.length === 0);
      return !isAlreadySelected && hasNoDepartments;
    });
    
    if (!searchQuery.trim()) {
      setFilteredUsers(availableUsers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = availableUsers.filter(user =>
      (user.fullName?.toLowerCase() || '').includes(query) ||
      (user.userId?.toLowerCase() || '').includes(query) ||
      (user.mobileNumber || '').includes(query)
    );
    
    setFilteredUsers(filtered);
  };

  const validateDepartmentName = async (name: string) => {
    if (!name.trim()) {
      setNameError('Department name is required');
      return false;
    }

    if (name.trim().length < 3) {
      setNameError('Department name must be at least 3 characters');
      return false;
    }

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
    // Since we're only showing unassigned users, we can directly add them
    setSelectedUsers(prev => [...prev, user]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(user => user.userId !== userId));
  };

  // const handleSelectHOD = (user: DepartmentUser) => {
  //   if (!isKaryalay) return;
    
  //   if (user.department && user.departmentId) {
  //     Alert.alert(
  //       'User Already Assigned',
  //       `${user.fullName} is already assigned to "${user.department}" department.`,
  //       [{ text: 'OK' }]
  //     );
  //     return;
  //   }

  //   setSelectedHODs(prev => [...prev, user]);
  // };

  // const handleRemoveHOD = (userId: string) => {
  //   setSelectedHODs(prev => prev.filter(hod => hod.userId !== userId));
  // };

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
      const hodList: string[] = []; // Empty HOD list initially

      console.log('Creating department with:', {
        departmentName: departmentName.trim(),
        userList,
        hodList
      });

      const response = await createDepartment({
        departmentName: departmentName.trim(),
        userList,
        hodList
      });

      console.log('Department creation response:', response);

      Alert.alert(
        'Success',
        `Department "${departmentName.trim()}" created successfully with ${selectedUsers.length} users!`,
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      console.error('Error creating department:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create department';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const UserItem = ({ user, isSelected = false, onPress }: {
    user: DepartmentUser;
    isSelected?: boolean;
    onPress: () => void;
  }) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        className="p-4 border-b border-gray-100"
      >
        <View className="flex-row items-center">
          <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
            <Text className="text-blue-600 font-semibold">
              {user.fullName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          
          <View className="flex-1">
            <Text className="font-semibold text-gray-800">{user.fullName || 'Unknown User'}</Text>
            <Text className="text-gray-500 text-sm">{user.mobileNumber || 'No mobile'}</Text>
          </View>

          <View className="items-end">
            {user.isAdmin && (
              <View className="bg-green-100 px-2 py-1 rounded mb-1">
                <Text className="text-green-600 text-xs font-medium">HOD</Text>
              </View>
            )}
            
            {isSelected ? (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
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

  // filteredUsers already contains only unassigned users
  const availableUsers = filteredUsers;

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
        {availableUsers.length > 0 && (
          <View className="bg-white mb-2">
            <View className="p-6 pb-3">
              <Text className="text-lg font-bold text-gray-800">
                Available Users ({availableUsers.length})
              </Text>
              <Text className="text-gray-500 text-sm">
                Only users not assigned to any department are shown
              </Text>
            </View>
            {availableUsers.map((user) => (
              <UserItem
                key={user.userId}
                user={user}
                onPress={() => handleSelectUser(user)}
              />
            ))}
          </View>
        )}

        {/* No Users Available */}
        {availableUsers.length === 0 && (
          <View className="bg-white mb-2 p-6">
            <View className="items-center py-8">
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 text-center mt-4">
                {searchQuery ? 'No users found matching your search' : 'All users are already assigned to departments'}
              </Text>
            </View>
          </View>
        )}

        {/* Create Button */}
        <View className="p-6">
          <CustomButton
            title={isCreating ? 'Creating Department...' : 'Create Department'}
            onPress={handleCreateDepartment}
            disabled={isCreating || selectedUsers.length === 0 || !departmentName.trim() || nameError !== ''}
            loading={isCreating}
            bgVariant="primary"
            className="h-14 rounded-xl"
          />
          {isCreating && (
            <View className="flex-row items-center justify-center mt-3">
              <Text className="text-gray-600 text-sm">
                Adding {selectedUsers.length} users to "{departmentName.trim()}" department...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
} 