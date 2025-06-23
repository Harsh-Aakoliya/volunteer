import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomButton from '@/components/ui/CustomButton';
import { Department, DepartmentUser } from '@/types/type';
import { fetchDepartmentById, removeUserFromDepartment, fetchAllUsers } from '@/api/department';

export default function DepartmentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [department, setDepartment] = useState<Department | null>(null);
  const [departmentUsers, setDepartmentUsers] = useState<DepartmentUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadDepartmentData();
    }
  }, [id]);

  const loadDepartmentData = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      setError(null);

      const [departmentData, allUsers] = await Promise.all([
        fetchDepartmentById(id),
        fetchAllUsers()
      ]);

      setDepartment(departmentData);
      
      // Filter users that belong to this department
      const usersInDepartment = allUsers.filter(user => 
        departmentData.userList?.includes(user.userId) || 
        departmentData.adminList?.includes(user.userId)
      );
      
      setDepartmentUsers(usersInDepartment);
    } catch (error) {
      console.error('Error loading department:', error);
      setError(error instanceof Error ? error.message : 'Failed to load department');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDepartmentData(false);
  };

  const handleRemoveUser = (user: DepartmentUser) => {
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${user.fullName} from this department?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeUserFromDepartment(id, user.userId);
              await loadDepartmentData(false);
              Alert.alert('Success', 'User removed successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove user');
            }
          },
        },
      ]
    );
  };

  const UserCard = ({ user }: { user: DepartmentUser }) => {
    const isAdmin = department?.adminList?.includes(user.userId);
    
    return (
      <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-3">
        <View className="flex-row items-center">
          <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
            <Text className="text-blue-600 font-semibold text-lg">
              {user.fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="font-semibold text-gray-800 text-lg">
                {user.fullName}
              </Text>
              {isAdmin && (
                <View className="bg-green-100 px-2 py-1 rounded ml-2">
                  <Text className="text-green-600 text-xs font-medium">Admin</Text>
                </View>
              )}
            </View>
            <Text className="text-gray-500 text-sm">{user.mobileNumber}</Text>
            <Text className="text-gray-500 text-sm">ID: {user.userId}</Text>
            {user.xetra && (
              <Text className="text-blue-500 text-sm">Xetra: {user.xetra}</Text>
            )}
            {user.mandal && (
              <Text className="text-blue-500 text-sm">Mandal: {user.mandal}</Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => handleRemoveUser(user)}
            className="p-2"
          >
            <Ionicons name="close-circle" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0286ff" />
        <Text className="text-gray-600 mt-2">Loading department...</Text>
      </View>
    );
  }

  if (error || !department) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-red-500 text-center mb-4">
          {error || 'Department not found'}
        </Text>
        <CustomButton
          title="Go Back"
          onPress={() => router.back()}
          bgVariant="primary"
        />
      </View>
    );
  }

  const admins = departmentUsers.filter(user => department.adminList?.includes(user.userId));
  const users = departmentUsers.filter(user => 
    department.userList?.includes(user.userId) && !department.adminList?.includes(user.userId)
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient colors={['#0286ff', '#0255ff']} className="pt-14 pb-6 px-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-white" numberOfLines={1}>
                {department.departmentName}
              </Text>
              <Text className="text-white/80 text-sm">
                Created on {new Date(department.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1 px-6 py-6"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Statistics */}
        <View className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-4">Department Statistics</Text>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-3xl font-bold text-blue-600">
                {departmentUsers.length}
              </Text>
              <Text className="text-gray-600 text-sm">Total Members</Text>
            </View>
            <View className="items-center">
              <Text className="text-3xl font-bold text-green-600">
                {admins.length}
              </Text>
              <Text className="text-gray-600 text-sm">Admins</Text>
            </View>
            <View className="items-center">
              <Text className="text-3xl font-bold text-orange-600">
                {users.length}
              </Text>
              <Text className="text-gray-600 text-sm">Users</Text>
            </View>
          </View>
        </View>

        {/* Admins Section */}
        {admins.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons name="shield-checkmark" size={24} color="#10B981" />
              <Text className="text-lg font-bold text-gray-800 ml-2">
                Admins ({admins.length})
              </Text>
            </View>
            {admins.map((user) => (
              <UserCard key={user.userId} user={user} />
            ))}
          </View>
        )}

        {/* Users Section */}
        {users.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons name="people" size={24} color="#0286ff" />
              <Text className="text-lg font-bold text-gray-800 ml-2">
                Users ({users.length})
              </Text>
            </View>
            {users.map((user) => (
              <UserCard key={user.userId} user={user} />
            ))}
          </View>
        )}

        {/* Empty state */}
        {departmentUsers.length === 0 && (
          <View className="items-center justify-center py-12">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="people" size={40} color="#6B7280" />
            </View>
            <Text className="text-xl font-bold text-gray-800 mb-2">
              No Members Yet
            </Text>
            <Text className="text-gray-500 text-center px-4">
              This department doesn't have any members assigned yet.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
} 