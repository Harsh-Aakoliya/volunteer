// app/chat/create-room.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { fetchChatUsers } from '@/api/chat';
import { ChatUser } from '@/types/type';
import Checkbox from 'expo-checkbox';
import CustomButton from '@/components/ui/CustomButton';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage } from '@/utils/authStorage';
import axios from 'axios';
import { API_URL } from '@/constants/api';

interface Department {
  departmentId: string;
  departmentName: string;
  users: ChatUser[];
}

export default function CreateRoomUserSelection() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isKaryalayAdmin, setIsKaryalayAdmin] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fetchCurrentLoggedUser = async () => {
      try {
        const currentUserData = await AuthStorage.getUser();
        console.log("Current user is:", currentUserData);
        setCurrentUser(currentUserData);
        
        // Check if user is Karyalay admin
        const isKaryalay = currentUserData?.isAdmin && currentUserData?.departments?.includes("Karyalay");
        setIsKaryalayAdmin(isKaryalay || false);
      } catch (error) {
        console.log("Error fetching current user:", error);
      }
    };
    fetchCurrentLoggedUser();
  }, []);

  useEffect(() => {
    const loadDepartmentsAndUsers = async () => {
      try {
        setIsLoading(true);
        const token = await AuthStorage.getToken();
        
        let departmentsResponse;
        
        if (isKaryalayAdmin) {
          // Karyalay admin can see all departments
          departmentsResponse = await axios.get(`${API_URL}/api/departments`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } else {
          // HOD can see only departments they manage
          departmentsResponse = await axios.get(`${API_URL}/api/departments/my-departments`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        console.log("Departments fetched:", departmentsResponse.data);
        
        // Get users for each department
        const departmentsWithUsers = await Promise.all(
          departmentsResponse.data.map(async (dept: any) => {
            try {
              // Get users for this department
              const usersResponse = await axios.get(`${API_URL}/api/departments/${dept.departmentId}/users`, {
                headers: { Authorization: `Bearer ${token}` }
              });
        
              // ✅ FILTER OUT CURRENT USER
              const filteredUsers = usersResponse.data.filter(
                (user: ChatUser) => user.userId !== currentUser?.userId
              );
        
              return {
                departmentId: dept.departmentId,
                departmentName: dept.departmentName,
                users: filteredUsers // ✅ Use filtered list
              };
            } catch (error) {
              console.error(`Error loading users for department ${dept.departmentId}:`, error);
              return {
                departmentId: dept.departmentId,
                departmentName: dept.departmentName,
                users: []
              };
            }
          })
        );
        
        setDepartments(departmentsWithUsers);
        console.log("Departments with users:", departmentsWithUsers);
        
      } catch (error) {
        console.error('Error loading departments and users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser) {
      loadDepartmentsAndUsers();
    }
  }, [currentUser, isKaryalayAdmin]);

  // Toggle department expansion
  const toggleDepartment = (departmentId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(departmentId)) {
      newExpanded.delete(departmentId);
    } else {
      newExpanded.add(departmentId);
    }
    setExpandedDepartments(newExpanded);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      return newSelected;
    });
  };

  const toggleDepartmentSelection = (departmentId: string) => {
    const department = departments.find(dept => dept.departmentId === departmentId);
    if (!department) return;

    const departmentUserIds = department.users.map(user => user.userId);
    const allUsersInDeptSelected = departmentUserIds.every(userId => selectedUsers.has(userId));

    setSelectedUsers(prev => {
      const newSelected = new Set(prev);
      if (allUsersInDeptSelected) {
        // Remove all users from this department
        departmentUserIds.forEach(userId => newSelected.delete(userId));
      } else {
        // Add all users from this department
        departmentUserIds.forEach(userId => newSelected.add(userId));
      }
      return newSelected;
    });
  };

  const renderUserItem = (user: ChatUser) => {
    const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : '?';
    const displayName = user.fullName || 'Unknown User';
    const isSelected = selectedUsers.has(user.userId);

    return (
      <TouchableOpacity 
        key={user.userId}
        className={`flex-row items-center p-3 ml-4 border-b border-gray-100 ${
          isSelected ? 'bg-blue-50' : 'bg-white'
        }`}
        onPress={() => toggleUserSelection(user.userId)}
      >
        <Checkbox
          value={isSelected}
          onValueChange={() => toggleUserSelection(user.userId)}
          className="mr-3"
          color={isSelected ? '#0284c7' : undefined}
        />
        <View className="flex-row items-center flex-1">
          <View className="w-8 h-8 bg-blue-100 rounded-full justify-center items-center mr-3">
            <Text className="text-blue-500 font-bold text-sm">
              {firstLetter}
            </Text>
          </View>
          <View>
            <Text className="text-base font-medium text-gray-800">{displayName}</Text>
            <Text className="text-gray-400 text-sm">{user.mobileNumber || ''}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDepartmentItem = (department: Department) => {
    const isExpanded = expandedDepartments.has(department.departmentId);
    const departmentUserIds = department.users.map(user => user.userId);
    const allUsersInDeptSelected = departmentUserIds.length > 0 && departmentUserIds.every(userId => selectedUsers.has(userId));
    const someUsersInDeptSelected = departmentUserIds.some(userId => selectedUsers.has(userId));

    return (
      <View key={department.departmentId} className="mb-4">
        <TouchableOpacity 
          className="flex-row items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
          onPress={() => toggleDepartment(department.departmentId)}
        >
          <View className="flex-row items-center flex-1">
            <Checkbox
              value={allUsersInDeptSelected}
              onValueChange={() => toggleDepartmentSelection(department.departmentId)}
              className="mr-3"
              color={allUsersInDeptSelected || someUsersInDeptSelected ? '#0284c7' : undefined}
            />
            <View className="w-10 h-10 bg-blue-100 rounded-full justify-center items-center mr-3">
              <Ionicons name="business" size={20} color="#0284c7" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800">{department.departmentName}</Text>
              <Text className="text-gray-500 text-sm">
                {department.users.length} users
                {someUsersInDeptSelected && ` (${departmentUserIds.filter(id => selectedUsers.has(id)).length} selected)`}
              </Text>
            </View>
          </View>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={24} 
            color="#9ca3af" 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View className="mt-2 bg-gray-50 rounded-lg border border-gray-200">
            {department.users.map(user => renderUserItem(user))}
            {department.users.length === 0 && (
              <View className="p-4 items-center">
                <Text className="text-gray-500">No users in this department</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const handleNextStep = () => {
    if (selectedUsers.size === 0) {
      alert("Please select at least one user");
      return;
    }
  
    // Convert the Set to an array of valid user IDs
    const selectedUserArray = Array.from(selectedUsers).filter(id => id && id.trim() !== '');
    selectedUserArray.push(currentUser.userId);
    if (selectedUserArray.length === 0) {
      alert("No valid users selected");
      return;
    }
    
    router.push({
      pathname: '/chat/create-room-metadata',
      params: { 
        selectedUserIds: selectedUserArray.join(',') 
      }
    });
  };

  // Filter departments based on search query
  const filteredDepartments = departments.filter(dept => 
    searchQuery === '' || 
    dept.departmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dept.users?.some((user: ChatUser) => 
      user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.mobileNumber?.includes(searchQuery)
    )
  );
  if (isLoading || !currentUser) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-gray-500 mt-2">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200">
        <Text className="text-xl font-bold mb-2">Select Users by Department</Text>
        <Text className="text-gray-600 mb-4">
          {isKaryalayAdmin 
            ? 'As Karyalay admin, you can add users from any department.'
            : `As HOD, you can add users from departments you manage (${currentUser.departments?.join(', ') || 'your departments'}).`}
        </Text>
        
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

      <ScrollView className="flex-1 p-4">
        {filteredDepartments.length > 0 ? (
          filteredDepartments.map(department => renderDepartmentItem(department))
        ) : (
          <View className="items-center py-8">
            <Text className="text-gray-500">
              {searchQuery 
                ? 'No departments or users found matching your search'
                : 'No departments available'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="p-4 bg-white border-t border-gray-200">
      <Text className="text-center mb-3 text-gray-600">
        You + {selectedUsers.size} other{selectedUsers.size !== 1 ? 's' : ''} ({selectedUsers.size + 1} total)
      </Text>
        <CustomButton
          title="Next Step"
          onPress={handleNextStep}
          disabled={selectedUsers.size === 0}
          bgVariant="primary"
          IconRight={() => <Ionicons name="arrow-forward" size={20} color="white" />}
        />
      </View>
    </View>
  );
}