import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Checkbox from 'expo-checkbox';
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import axios from 'axios';
import { ChatUser } from '@/types/type';

interface Department {
  departmentName: string;
  users: ChatUser[];
  isExpanded: boolean;
}

interface Step3RecipientsProps {
  selectedUserIds: string[];
  lockedUserIds?: string[]; // Users who already received the announcement (but can still be unchecked)
  onNext: (selectedUserIds: string[]) => void;
  onBack: () => void;
  isEdit?: boolean;
}

export default function Step3Recipients({ 
  selectedUserIds: initialSelectedUserIds,
  lockedUserIds = [],
  onNext, 
  onBack,
  isEdit = false
}: Step3RecipientsProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialSelectedUserIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [userDepartment, setUserDepartment] = useState('');
  const [isKaryalay, setIsKaryalay] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getCurrentUser = async () => {
      const userData = await AuthStorage.getUser();
      if (userData) {
        setUserDepartment(userData.department || '');
        setIsKaryalay(userData.department === 'Karyalay');
      }
    };
    getCurrentUser();
    loadDepartmentsWithUsers();
  }, []);

  // Update selected users when initial props change
  useEffect(() => {
    console.log('Step3Recipients: Updating selected users from props:', initialSelectedUserIds);
    setSelectedUserIds(initialSelectedUserIds);
  }, [initialSelectedUserIds]);

  // Debug effect to log current state
  useEffect(() => {
    console.log('Step3Recipients: Current state:', {
      selectedUserIds,
      lockedUserIds,
      isEdit,
      initialSelectedUserIds
    });
  }, [selectedUserIds, lockedUserIds, isEdit, initialSelectedUserIds]);

  // Filter departments and users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDepartments(departments);
    } else {
      const filtered = departments.map(dept => ({
        ...dept,
        users: dept.users.filter(user => 
          (user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
          (user.mobileNumber?.includes(searchQuery) || false)
        )
      })).filter(dept => dept.users.length > 0);
      setFilteredDepartments(filtered);
    }
  }, [searchQuery, departments]);

  const loadDepartmentsWithUsers = async () => {
    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();

      // Get all departments
      const deptResponse = await axios.get(`${API_URL}/api/announcements/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Get all users with department information
      const usersResponse = await axios.get(`${API_URL}/api/chat/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const allUsers = usersResponse.data;
      const departmentNames = deptResponse.data;

      // Group users by department
      const departmentMap: { [key: string]: ChatUser[] } = {};
      
      // Initialize all departments
      departmentNames.forEach((deptName: string) => {
        departmentMap[deptName] = [];
      });

      // Group users by their department
      allUsers.forEach((user: any) => {
        if (user.department && departmentMap.hasOwnProperty(user.department)) {
          departmentMap[user.department].push({
            userId: user.userId,
            fullName: user.fullName,
            mobileNumber: user.mobileNumber,
            department: user.department
          });
        }
      });

      // Convert to department array format and filter based on user access
      let departmentList: Department[] = Object.entries(departmentMap)
        .filter(([_, users]) => users.length > 0)
        .map(([deptName, users]) => ({
          departmentName: deptName,
          users: users,
          isExpanded: false
        }));

      // Filter departments based on user access level
      if (!isKaryalay && userDepartment) {
        // HODs can only see their own department
        departmentList = departmentList.filter(dept => dept.departmentName === userDepartment);
      }
      // Karyalay users can see all departments

      setDepartments(departmentList);
      setFilteredDepartments(departmentList);
    } catch (error) {
      console.error('Error loading departments with users:', error);
      alert('Failed to load departments and users');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDepartmentExpansion = (departmentName: string) => {
    setDepartments(prev => {
      const updated = prev.map(dept => 
        dept.departmentName === departmentName 
          ? { ...dept, isExpanded: !dept.isExpanded }
          : dept
      );
      
      // Also update filtered departments to maintain expansion state
      setFilteredDepartments(currentFiltered => 
        currentFiltered.map(dept => 
          dept.departmentName === departmentName 
            ? { ...dept, isExpanded: !dept.isExpanded }
            : dept
        )
      );
      
      return updated;
    });
  };

  const toggleUserSelection = (userId: string) => {
    // Allow toggling all users, including those who already received the announcement
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleDepartmentSelection = (departmentName: string) => {
    const department = departments.find(d => d.departmentName === departmentName);
    if (!department) return;

    const allUsers = department.users;
    const allUsersSelected = allUsers.length > 0 && 
      allUsers.every(user => selectedUserIds.includes(user.userId));

    if (allUsersSelected) {
      // Deselect all users from this department
      setSelectedUserIds(prev => prev.filter(id => 
        !allUsers.some(user => user.userId === id)
      ));
    } else {
      // Select all users from this department
      const userIds = allUsers.map(user => user.userId);
      setSelectedUserIds(prev => [...new Set([...prev, ...userIds])]);
    }
  };

  const handleNext = () => {
    onNext(selectedUserIds);
  };

  const renderDepartmentHeader = (department: Department) => {
    const allUsers = department.users;
    const allUsersSelected = allUsers.length > 0 && 
      allUsers.every(user => selectedUserIds.includes(user.userId));
    const someSelected = selectedUserIds.some(id => department.users.some(user => user.userId === id)) && !allUsersSelected;

    return (
      <View className="bg-gray-100 p-3 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => toggleDepartmentExpansion(department.departmentName)}
              className="mr-3 p-1"
            >
              <Ionicons 
                name={department.isExpanded ? "chevron-down" : "chevron-forward"} 
                size={20} 
                color="#6b7280" 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => toggleDepartmentExpansion(department.departmentName)}
              className="flex-1"
            >
              <Text className="text-lg font-bold text-gray-800">
                {department.departmentName}
              </Text>
              <Text className="text-sm text-gray-600">
                {selectedUserIds.filter(id => department.users.some(user => user.userId === id)).length}/{department.users.length} selected
              </Text>
            </TouchableOpacity>
          </View>
          
          <View className="flex-row items-center">
            <Checkbox
              value={allUsersSelected}
              onValueChange={() => toggleDepartmentSelection(department.departmentName)}
              color={allUsersSelected ? '#0284c7' : someSelected ? '#0284c7' : undefined}
              style={{ 
                transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
                opacity: someSelected ? 0.6 : 1
              }}
              disabled={allUsers.length === 0}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderUserItem = (user: ChatUser) => {
    const isSelected = selectedUserIds.includes(user.userId);
    const wasAlreadySent = lockedUserIds.includes(user.userId);
    const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : '?';

    return (
      <TouchableOpacity
        key={user.userId}
        onPress={() => toggleUserSelection(user.userId)}
        className={`flex-row items-center p-3 border-b border-gray-100 ${
          isSelected ? 'bg-blue-50' : 'bg-white'
        }`}
      >
        <Checkbox
          value={isSelected}
          onValueChange={() => toggleUserSelection(user.userId)}
          className="mr-3"
          color={isSelected ? '#0284c7' : undefined}
        />
        
        <View className="w-10 h-10 rounded-full justify-center items-center mr-3 bg-blue-100">
          <Text className="font-bold text-blue-500">
            {firstLetter}
          </Text>
        </View>
        
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-base font-medium text-gray-800">
              {user.fullName || 'Unknown User'}
            </Text>
            {wasAlreadySent && (
              <View className="ml-2 flex-row items-center">
                <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                <Text className="text-xs text-green-600 ml-1">Already sent</Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-gray-500">
            {user.mobileNumber || 'No phone number'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isFormValid = selectedUserIds.length > 0;

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={onBack} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Recipients' : 'Select Recipients'}
        </Text>
        
        <View className="w-8" />
      </View>

      {/* Step indicator */}
      <View className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <Text className="text-blue-800 font-medium text-center">Step 3 of 4: Recipients</Text>
        <Text className="text-blue-600 text-sm text-center mt-1">
          {isEdit 
            ? (isKaryalay 
              ? 'Select users to receive this announcement. You can uncheck users who already received it.'
              : 'Select users from your department. You can uncheck users who already received it.')
            : (isKaryalay 
              ? 'Select departments and users to receive this announcement'
              : 'Select users from your department to receive this announcement')
          }
        </Text>
      </View>

      <View className="flex-1">
        {/* Search Bar */}
        <View className="p-4 bg-white border-b border-gray-200">
          <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
            <Ionicons name="search" size={20} color="#6b7280" />
            <TextInput
              className="flex-1 ml-2 text-base"
              placeholder="Search departments or users..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Department and User Selector */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#0284c7" />
            <Text className="text-gray-500 mt-2">Loading users...</Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4 py-2">
            {filteredDepartments.length === 0 ? (
              <View className="justify-center items-center p-4">
                <Ionicons name="people-outline" size={60} color="#d1d5db" />
                <Text className="text-gray-500 mt-4 text-center">
                  {searchQuery.length > 0 
                    ? "No users match your search" 
                    : "No users available"}
                </Text>
              </View>
            ) : (
              filteredDepartments.map((department) => (
                <View key={department.departmentName} className="mb-2 bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                  {renderDepartmentHeader(department)}
                  
                  {department.isExpanded && (
                    <View>
                      {department.users.map(user => renderUserItem(user))}
                    </View>
                  )}
                </View>
              ))
            )}
            
            {/* Show info about previously sent users */}
            {isEdit && lockedUserIds.length > 0 && (
              <View className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text className="text-green-800 font-medium ml-2">
                    Previously Sent Users
                  </Text>
                </View>
                <Text className="text-green-700 text-sm">
                  {lockedUserIds.length} user{lockedUserIds.length !== 1 ? 's' : ''} already received this announcement. 
                  You can uncheck them if you don't want them to see it anymore, or select additional users.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Validation Notice and Navigation */}
      <View className="p-4 bg-white border-t border-gray-200">
        {/* Selection Summary */}
        <View className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <View className="flex-row items-center mb-1">
            <Ionicons name="people" size={16} color="#2563eb" />
            <Text className="text-blue-800 font-medium ml-2">
              Selection Summary
            </Text>
          </View>
          <Text className="text-blue-700 text-sm">
            {selectedUserIds.length > 0 
              ? `Selected ${selectedUserIds.length} user${selectedUserIds.length !== 1 ? 's' : ''}`
              : 'No users selected'
            }
          </Text>
          {isEdit && lockedUserIds.length > 0 && (
            <Text className="text-blue-600 text-xs mt-1">
              ({lockedUserIds.filter(id => selectedUserIds.includes(id)).length}/{lockedUserIds.length} previously sent users still selected)
            </Text>
          )}
        </View>

        {/* Validation Notice */}
        {!isFormValid && (
          <View className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <View className="flex-row items-center">
              <Ionicons name="warning" size={16} color="#ea580c" />
              <Text className="text-orange-800 font-medium ml-2">Selection required</Text>
            </View>
            <Text className="text-orange-700 text-sm mt-1">
              You must select at least one user to continue.
            </Text>
          </View>
        )}
        
        {/* Navigation Buttons */}
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={onBack}
            className="flex-1 py-3 px-6 rounded-lg border border-gray-300"
          >
            <Text className="text-gray-700 text-center font-semibold">Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleNext}
            disabled={!isFormValid}
            className={`flex-1 py-3 px-6 rounded-lg ${
              isFormValid 
                ? 'bg-blue-600' 
                : 'bg-gray-300'
            }`}
          >
            <Text className={`text-center font-semibold ${
              isFormValid 
                ? 'text-white' 
                : 'text-gray-500'
            }`}>
              Next: Preview
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
