import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomButton from '@/components/ui/CustomButton';
import { Department } from '@/types/type';
import { fetchMyDepartments } from '@/api/department';
import { AuthStorage } from '@/utils/authStorage';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadDepartments = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      setError(null);
      
      const data = await fetchMyDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Error loading departments:', error);
      setError(error instanceof Error ? error.message : 'Failed to load departments');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDepartments();
      checkAdminStatus();
    }, [])
  );

  const checkAdminStatus = async () => {
    try {
      const userDataString = await AuthStorage.getUser();
      console.log("userDataString", userDataString);
      // console.log("userDataString", userDataString);
      setIsAdmin(userDataString?.isAdmin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDepartments(false);
  };

  const handleViewDepartment = (departmentId: string) => {
    router.push(`/departments/${departmentId}`);
  };

  const handleCreateDepartment = () => {
    router.push('/(departments)/create');
  };

  const DepartmentCard = ({ department }: { department: Department }) => (
    <TouchableOpacity
      onPress={() => handleViewDepartment(department.departmentId)}
      className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4"
    >
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800 mb-1">
            {department.departmentName}
          </Text>
          <Text className="text-gray-500 text-sm">
            Created on {new Date(department.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B7280" />
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center space-x-4">
          <View className="flex-row items-center">
            <Ionicons name="people" size={16} color="#0286ff" />
            <Text className="text-gray-600 text-sm ml-1">
              {department.userList?.length || 0} Members
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <Text className="text-gray-600 text-sm ml-1">
              {department.adminList?.length || 0} Admins
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0286ff" />
        <Text className="text-gray-600 mt-2">Loading departments...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient colors={['#0286ff', '#0255ff']} className="pt-14 pb-6 px-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-white">Departments</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={handleCreateDepartment}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        className="flex-1 px-6 py-6"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View className="bg-red-50 p-4 rounded-xl mb-4">
            <Text className="text-red-600 text-center font-medium mb-2">Error Loading Departments</Text>
            <Text className="text-red-500 text-center text-sm mb-3">{error}</Text>
            <CustomButton
              title="Retry"
              onPress={() => loadDepartments()}
              bgVariant="danger"
            />
          </View>
        ) : departments.length === 0 ? (
          <View className="items-center justify-center py-12">
            <View className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="business" size={40} color="#0286ff" />
            </View>
            <Text className="text-xl font-bold text-gray-800 mb-2">
              No Departments Available
            </Text>
            <Text className="text-gray-500 text-center mb-6 px-4">
              You are not currently assigned to any departments or no departments have been created yet.
            </Text>
          </View>
        ) : (
          <>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-800">
                Available Departments ({departments.length})
              </Text>
              {isAdmin && (
                <CustomButton
                  title="Create New"
                  onPress={handleCreateDepartment}
                  bgVariant="primary"
                  className="px-4 py-2 h-auto"
                  IconLeft={() => <Ionicons name="add" size={16} color="white" />}
                />
              )}
            </View>

            {departments.map((department) => (
              <DepartmentCard key={department.departmentId} department={department} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
} 