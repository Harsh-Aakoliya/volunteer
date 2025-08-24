// components/texteditor/DepartmentSelector.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Checkbox from 'expo-checkbox';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import { ChatUser } from '@/types/type';

interface Department {
  departmentName: string;
  users: ChatUser[];
  isExpanded: boolean;
  selectedUsers: Set<string>;
}

interface DepartmentSelectorProps {
  onSelectionChange?: (selectedUsers: ChatUser[]) => void;
  excludeUserIds?: string[]; // Users to exclude from selection (e.g., existing members)
  searchQuery?: string;
  // Props for announcement texteditor
  selectedDepartments?: string[];
  onDepartmentsChange?: (departments: string[]) => void;
  userDepartment?: string;
  // Props for locked users (users who already received announcement)
  lockedUserIds?: string[];
}

export default function DepartmentSelector({ 
  onSelectionChange, 
  excludeUserIds = [],
  searchQuery = '',
  selectedDepartments = [],
  onDepartmentsChange,
  userDepartment = '',
  lockedUserIds = []
}: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  
  // For announcement mode (when onDepartmentsChange is provided)
  const isAnnouncementMode = !!onDepartmentsChange;

  useEffect(() => {
    loadDepartmentsWithUsers();
  }, []);

  // Initialize selected departments for announcement mode
  useEffect(() => {
    if (isAnnouncementMode && selectedDepartments.length > 0) {
      setDepartments(prevDepts => {
        return prevDepts.map(dept => {
          if (selectedDepartments.includes(dept.departmentName)) {
            return {
              ...dept,
              selectedUsers: new Set(dept.users.map(user => user.userId))
            };
          }
          return dept;
        });
      });
    }
  }, [selectedDepartments, isAnnouncementMode]);

  useEffect(() => {
    // Filter departments and users based on search query
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
          // Exclude users that are in the excludeUserIds list
          if (!excludeUserIds.includes(user.userId)) {
            departmentMap[user.department].push({
              userId: user.userId,
              fullName: user.fullName,
              mobileNumber: user.mobileNumber,
              department: user.department
            });
          }
        }
      });

      // Convert to department array format
      const departmentList: Department[] = Object.entries(departmentMap)
        .filter(([_, users]) => users.length > 0) // Only include departments with users
        .map(([deptName, users]) => ({
          departmentName: deptName,
          users: users,
          isExpanded: false,
          selectedUsers: new Set<string>()
        }));

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
    setDepartments(prev => prev.map(dept => 
      dept.departmentName === departmentName 
        ? { ...dept, isExpanded: !dept.isExpanded }
        : dept
    ));
  };



  const toggleUserSelection = (departmentName: string, userId: string) => {
    setDepartments(prev => {
      const updated = prev.map(dept => {
        if (dept.departmentName === departmentName) {
          const newSelectedUsers = new Set(dept.selectedUsers);
          if (newSelectedUsers.has(userId)) {
            newSelectedUsers.delete(userId);
          } else {
            newSelectedUsers.add(userId);
          }
          return { ...dept, selectedUsers: newSelectedUsers };
        }
        return dept;
      });
      
      // Notify parent of selection change
      notifySelectionChange(updated);
      return updated;
    });
  };

  const notifySelectionChange = (updatedDepartments: Department[]) => {
    if (isAnnouncementMode && onDepartmentsChange) {
      // For announcement mode, notify department selection
      const selectedDeptNames = updatedDepartments
        .filter(dept => dept.selectedUsers.size > 0)
        .map(dept => dept.departmentName);
      onDepartmentsChange(selectedDeptNames);
    } else if (onSelectionChange) {
      // For chat mode, notify user selection
      const allSelectedUsers: ChatUser[] = [];
      updatedDepartments.forEach(dept => {
        dept.users.forEach(user => {
          if (dept.selectedUsers.has(user.userId)) {
            allSelectedUsers.push(user);
          }
        });
      });
      onSelectionChange(allSelectedUsers);
    }
  };

  // Toggle entire department selection for announcement mode
  const toggleDepartmentSelection = (departmentName: string) => {
    setDepartments(prevDepts => {
      const updated = prevDepts.map(dept => {
        if (dept.departmentName === departmentName) {
          // Check if all non-locked users are selected
          const selectableUsers = dept.users.filter(user => !lockedUserIds.includes(user.userId));
          const allSelectableSelected = selectableUsers.length > 0 && 
            selectableUsers.every(user => dept.selectedUsers.has(user.userId));
          
          const newSelectedUsers = new Set(dept.selectedUsers);
          
          if (allSelectableSelected) {
            // Deselect all selectable users (keep locked users selected)
            selectableUsers.forEach(user => {
              newSelectedUsers.delete(user.userId);
            });
          } else {
            // Select all selectable users (locked users remain as they are)
            selectableUsers.forEach(user => {
              newSelectedUsers.add(user.userId);
            });
          }
          
          return {
            ...dept,
            selectedUsers: newSelectedUsers
          };
        }
        return dept;
      });
      
      notifySelectionChange(updated);
      return updated;
    });
  };

  const renderDepartmentHeader = (department: Department) => {
    // Check selection status for non-locked users only
    const selectableUsers = department.users.filter(user => !lockedUserIds.includes(user.userId));
    const allSelectableSelected = selectableUsers.length > 0 && 
      selectableUsers.every(user => department.selectedUsers.has(user.userId));
    const someSelected = department.selectedUsers.size > 0 && !allSelectableSelected;

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
                {department.selectedUsers.size}/{department.users.length} selected
              </Text>
            </TouchableOpacity>
          </View>
          
          <View className="flex-row items-center">
            <Checkbox
              value={allSelectableSelected}
              onValueChange={() => toggleDepartmentSelection(department.departmentName)}
              color={allSelectableSelected ? '#0284c7' : someSelected ? '#0284c7' : undefined}
              style={{ 
                transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
                opacity: someSelected ? 0.6 : 1
              }}
              disabled={selectableUsers.length === 0}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderUserItem = (user: ChatUser, department: Department) => {
    const isSelected = department.selectedUsers.has(user.userId);
    const isLocked = lockedUserIds.includes(user.userId);
    const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : '?';

    return (
      <TouchableOpacity
        key={user.userId}
        onPress={() => !isLocked && toggleUserSelection(department.departmentName, user.userId)}
        disabled={isLocked}
        className={`flex-row items-center p-3 border-b border-gray-100 ${
          isLocked ? 'bg-gray-100' : isSelected ? 'bg-blue-50' : 'bg-white'
        }`}
      >
        <Checkbox
          value={isSelected}
          onValueChange={() => !isLocked && toggleUserSelection(department.departmentName, user.userId)}
          className="mr-3"
          color={isSelected ? '#0284c7' : undefined}
          disabled={isLocked}
        />
        
        <View className={`w-10 h-10 rounded-full justify-center items-center mr-3 ${
          isLocked ? 'bg-gray-300' : 'bg-blue-100'
        }`}>
          <Text className={`font-bold ${
            isLocked ? 'text-gray-500' : 'text-blue-500'
          }`}>
            {firstLetter}
          </Text>
        </View>
        
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className={`text-base font-medium ${
              isLocked ? 'text-gray-500' : 'text-gray-800'
            }`}>
              {user.fullName || 'Unknown User'}
            </Text>
            {isLocked && (
              <View className="ml-2 flex-row items-center">
                <Ionicons name="lock-closed" size={14} color="#6b7280" />
                <Text className="text-xs text-gray-500 ml-1">Already sent</Text>
              </View>
            )}
          </View>
          <Text className={`text-sm ${
            isLocked ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {user.mobileNumber || 'No phone number'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };



  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-gray-500 mt-2">Loading departments...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <Text className="text-lg font-semibold text-gray-900 mb-3">Select Departments</Text>
      {filteredDepartments.length === 0 ? (
        <View className="justify-center items-center p-4">
          <Ionicons name="business-outline" size={60} color="#d1d5db" />
          <Text className="text-gray-500 mt-4 text-center">
            {searchQuery.length > 0 
              ? "No departments or users match your search" 
              : "No departments available"}
          </Text>
        </View>
      ) : (
        filteredDepartments.map((department) => (
          <View key={department.departmentName} className="mb-2 bg-white rounded-lg shadow-sm overflow-hidden">
            {renderDepartmentHeader(department)}
            
            {department.isExpanded && (
              <View>
                {department.users.map(user => renderUserItem(user, department))}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}