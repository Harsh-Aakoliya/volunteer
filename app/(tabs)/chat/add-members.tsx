// app/chat/add-members.tsx
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
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import CustomButton from '@/components/ui/CustomButton';

export default function AddMembers() {
  const { roomId } = useLocalSearchParams();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [existingMembers, setExistingMembers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isKaryalayAdmin, setIsKaryalayAdmin] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  console.log("Here in add members page", roomId);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userData = await AuthStorage.getUser();
        setCurrentUser(userData);
        
        // Check if user is Karyalay admin
        const isKaryalay = userData?.isAdmin && userData?.departments?.includes("Karyalay");
        setIsKaryalayAdmin(isKaryalay || false);
        console.log("isKaryalayAdmin", isKaryalayAdmin);
        console.log("userData in add members page", userData);
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const loadDepartmentsAndUsers = async () => {
      try {
        setIsLoading(true);
        const token = await AuthStorage.getToken();
        
        // Get existing room members
        const roomResponse = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        console.log("room response", roomResponse.data);
        
        const memberIds = roomResponse.data.members.map((member: any) => member.userId);
        setExistingMembers(memberIds);
        
        // Get departments based on user role
        const departmentsResponse = await axios.get(`${API_URL}/api/departments/my-departments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("Departments fetched:", departmentsResponse.data);
        
        // Get users for each department
        const departmentsWithUsers = await Promise.all(
          departmentsResponse.data.map(async (dept: any) => {
            try {
              // Get users for this department
              const usersResponse = await axios.get(`${API_URL}/api/departments/${dept.departmentId}/users`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              // Filter out users who are already members
              const availableUsers = usersResponse.data.filter(
                (user: any) => !memberIds.includes(user.userId)
              );
              
              return {
                ...dept,
                users: availableUsers
              };
            } catch (error) {
              console.error(`Error loading users for department ${dept.departmentId}:`, error);
              return {
                ...dept,
                users: []
              };
            }
          })
        );
        
        setDepartments(departmentsWithUsers);
        console.log("Departments with users:", departmentsWithUsers);
        
      } catch (error) {
        console.error('Error loading departments and users:', error);
        alert('Failed to load departments and users: ' + (error as any).message);
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId && currentUser) {
      loadDepartmentsAndUsers();
    }
  }, [roomId, currentUser]);

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
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const addMembersToRoom = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      console.log("Adding members:", selectedUsers);
      const token = await AuthStorage.getToken();
      await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/members`,
        { userIds: selectedUsers },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Members added successfully');
      router.back();
    } catch (error) {
      console.error('Error adding members:', error);
      alert('Failed to add members: ' + (error as any).message);
    }
  };

  const renderUserItem = (user: any, isExistingMember: boolean) => (
    <TouchableOpacity 
      key={user.userId}
      className={`flex-row items-center justify-between p-3 ml-4 border-b border-gray-100 ${
        isExistingMember 
          ? 'bg-gray-100' 
          : selectedUsers.includes(user.userId) 
            ? 'bg-blue-50' 
            : 'bg-white'
      }`}
      onPress={() => !isExistingMember && toggleUserSelection(user.userId)}
      disabled={isExistingMember}
    >
      <View className="flex-row items-center">
        <View className="w-8 h-8 bg-blue-100 rounded-full justify-center items-center mr-3">
          <Text className="text-blue-500 font-bold text-sm">
            {(user.fullName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text className={`text-base font-medium ${isExistingMember ? 'text-gray-500' : 'text-gray-800'}`}>
            {user.fullName || 'Unknown User'}
          </Text>
          <Text className="text-gray-400 text-sm">{user.mobileNumber || ''}</Text>
          {isExistingMember && (
            <Text className="text-red-500 text-xs">Already in room</Text>
          )}
        </View>
      </View>
      
      <View>
        {isExistingMember ? (
          <Ionicons name="checkmark-circle" size={20} color="#9ca3af" />
        ) : selectedUsers.includes(user.userId) ? (
          <Ionicons name="checkmark-circle" size={20} color="#0284c7" />
        ) : (
          <Ionicons name="add-circle-outline" size={20} color="#9ca3af" />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderDepartmentItem = (department: any) => {
    const isExpanded = expandedDepartments.has(department.departmentId);
    const availableUsers = department.users || [];
    const existingUsersInDept = department.userList?.filter((userId: string) => existingMembers.includes(userId)) || [];
    
    return (
      <View key={department.departmentId} className="mb-4">
        <TouchableOpacity 
          className="flex-row items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
          onPress={() => toggleDepartment(department.departmentId)}
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-blue-100 rounded-full justify-center items-center mr-3">
              <Ionicons name="business" size={20} color="#0284c7" />
            </View>
            <View>
              <Text className="text-lg font-bold text-gray-800">{department.departmentName}</Text>
              <Text className="text-gray-500 text-sm">
                {availableUsers.length} available users
                {existingUsersInDept.length > 0 && `, ${existingUsersInDept.length} already in room`}
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
            {/* Available users */}
            {availableUsers.map((user: any) => renderUserItem(user, false))}
            
            {/* Existing members from this department */}
            {department.userList?.filter((userId: string) => existingMembers.includes(userId)).map((userId: string) => {
              // Find user details from the department's users array
              const user = availableUsers.find((u: any) => u.userId === userId) || { userId, fullName: 'Unknown User', mobileNumber: '' };
              return renderUserItem(user, true);
            })}
            
            {availableUsers.length === 0 && existingUsersInDept.length === 0 && (
              <View className="p-4 items-center">
                <Text className="text-gray-500">No users in this department</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (isLoading || !currentUser) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-gray-500 mt-2">Loading...</Text>
      </View>
    );
  }

  // Filter departments based on search query
  const filteredDepartments = departments.filter(dept => 
    searchQuery === '' || 
    dept.departmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dept.users?.some((user: any) => 
      user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.mobileNumber?.includes(searchQuery)
    )
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200">
        <Text className="text-xl font-bold mb-2">Add Members by Department</Text>
        <Text className="text-gray-600 mb-4">
          {isKaryalayAdmin 
            ? 'As Karyalay admin, you can add users from any department.'
            : 'As HOD, you can add users from departments you manage.'}
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
          {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
        </Text>
        <CustomButton
          title="Add Selected Members"
          onPress={addMembersToRoom}
          disabled={selectedUsers.length === 0}
          bgVariant="primary"
        />
      </View>
    </View>
  );
}