import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomButton from '@/components/ui/CustomButton';
import { Department } from '@/types/type';
import { fetchMyDepartments, deleteDepartment } from '@/api/department';
import { AuthStorage } from '@/utils/authStorage';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isKaryalay, setIsKaryalay] = useState(false);

  const loadDepartments = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      setError(null);
      
      const data = await fetchMyDepartments();
      console.log("data in loadDepartments", data);
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
      checkUserRole();
    }, [])
  );

  const checkUserRole = async () => {
    try {
      const user = await AuthStorage.getUser();
      console.log("user in checkUserRole", user);
      const isKaryalayUser = Boolean(user?.isAdmin && user?.department === 'Karyalay');
      setIsKaryalay(isKaryalayUser);
      console.log("isKaryalay in checkUserRole", isKaryalayUser);
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDepartments(false);
  };

  const handleCreateDepartment = () => {
    router.push('/(departments)/create');
  };

  const handleViewDepartment = (departmentId: string) => {
    router.push(`/(departments)/${departmentId}`);
  };

  const handleDeleteDepartment = (department: Department) => {
    Alert.alert(
      'Delete Department',
      `Are you sure you want to delete "${department.departmentName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDepartment(department.departmentId);
              await loadDepartments(false);
              Alert.alert('Success', 'Department deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete department');
            }
          },
        },
      ]
    );
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
          {department.hodName && (
            <Text className="text-blue-600 text-sm">
              HOD: {department.hodName}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteDepartment(department)}
          className="p-2"
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center space-x-4">
          <View className="flex-row items-center">
            <Ionicons name="people" size={16} color="#0286ff" />
            <Text className="text-gray-600 text-sm ml-1">
              {department.userList?.length || 0} Users
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <Text className="text-gray-600 text-sm ml-1">
              {department.adminList?.length || 0} Admins
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B7280" />
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
          {isKaryalay && (
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
            <Text className="text-red-600 text-center">{error}</Text>
            <CustomButton
              title="Retry"
              onPress={() => loadDepartments()}
              className="mt-3"
              bgVariant="danger"
            />
          </View>
        ) : departments.length === 0 ? (
          <View className="items-center justify-center py-12">
            <View className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="business" size={40} color="#0286ff" />
            </View>
            <Text className="text-xl font-bold text-gray-800 mb-2">
              No Departments Yet
            </Text>
            <Text className="text-gray-500 text-center mb-6 px-4">
              {isKaryalay 
                ? "Create your first department to organize and manage your team members"
                : "No departments assigned to you yet. Contact Karyalay for department assignment."
              }
            </Text>
            {isKaryalay && (
              <CustomButton
                title="Create Department"
                onPress={handleCreateDepartment}
                bgVariant="primary"
                className="px-8"
              />
            )}
          </View>
        ) : (
          <>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-800">
                {isKaryalay ? `My Departments (${departments.length})` : `Assigned Departments (${departments.length})`}
              </Text>
              {isKaryalay && (
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