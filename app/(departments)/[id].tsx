import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Pressable
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomButton from '@/components/ui/CustomButton';
import { Department, DepartmentUser } from '@/types/type';
import { 
  fetchDepartmentById, 
  removeUserFromDepartment, 
  fetchAllUsers, 
  fetchSubdepartments,
  createSubdepartment,
  deleteSubdepartment
} from '@/api/department';
import { Subdepartment } from '@/types/type';
import { AuthStorage } from '@/utils/authStorage';

export default function DepartmentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [department, setDepartment] = useState<Department | null>(null);
  const [departmentUsers, setDepartmentUsers] = useState<DepartmentUser[]>([]);
  const [subdepartments, setSubdepartments] = useState<Subdepartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateSubdeptModal, setShowCreateSubdeptModal] = useState(false);
  const [newSubdeptName, setNewSubdeptName] = useState('');
  const [selectedSubdeptUsers, setSelectedSubdeptUsers] = useState<DepartmentUser[]>([]);
  const [isCreatingSubdept, setIsCreatingSubdept] = useState(false);
  const [isHODOrKaryalay, setIsHODOrKaryalay] = useState(false);

  useEffect(() => {
    if (id) {
      loadDepartmentData();
      checkUserPermissions();
    }
  }, [id]);

  const checkUserPermissions = async () => {
    try {
      const user = await AuthStorage.getUser();
      console.log("user in checkUserPermissions", user);
      const isKaryalay = Boolean(user?.isAdmin && user?.department === 'Karyalay');
      // Check if user is HOD of this department (will be determined after department loads)
      setIsHODOrKaryalay(isKaryalay);
    } catch (error) {
      console.error('Error checking user permissions:', error);
    }
  };

  const loadDepartmentData = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      setError(null);

      const [departmentData, allUsers, subdepartmentData] = await Promise.all([
        fetchDepartmentById(id),
        fetchAllUsers(),
        fetchSubdepartments(id)
      ]);

      setDepartment(departmentData);
      setSubdepartments(subdepartmentData);
      
      // Filter users that belong to this department
      const usersInDepartment = allUsers.filter(user => 
        departmentData.userList?.includes(user.userId) || 
        departmentData.adminList?.includes(user.userId)
      );
      
      setDepartmentUsers(usersInDepartment);

      // Update permission check if user is HOD of this department
      const user = await AuthStorage.getUser();
      console.log("user in loadDepartmentData", user);
      const isKaryalay = Boolean(user?.isAdmin && user?.department === 'Karyalay');
      const isHOD = departmentData.hodUserId === user?.userId;
      setIsHODOrKaryalay(isKaryalay || isHOD);
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

  const handleCreateSubdepartment = async () => {
    if (!newSubdeptName.trim()) {
      Alert.alert('Error', 'Please enter a subdepartment name');
      return;
    }

    if (selectedSubdeptUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user for the subdepartment');
      return;
    }

    try {
      setIsCreatingSubdept(true);
      
      await createSubdepartment(id, {
        subdepartmentName: newSubdeptName.trim(),
        userList: selectedSubdeptUsers.map(user => user.userId)
      });

      setShowCreateSubdeptModal(false);
      setNewSubdeptName('');
      setSelectedSubdeptUsers([]);
      await loadDepartmentData(false);
      Alert.alert('Success', 'Subdepartment created successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to create subdepartment');
    } finally {
      setIsCreatingSubdept(false);
    }
  };

  const handleDeleteSubdepartment = (subdepartment: Subdepartment) => {
    Alert.alert(
      'Delete Subdepartment',
      `Are you sure you want to delete "${subdepartment.subdepartmentName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubdepartment(id, subdepartment.subdepartmentId);
              await loadDepartmentData(false);
              Alert.alert('Success', 'Subdepartment deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete subdepartment');
            }
          },
        },
      ]
    );
  };

  const toggleUserSelection = (user: DepartmentUser) => {
    setSelectedSubdeptUsers(prev => {
      const isSelected = prev.some(u => u.userId === user.userId);
      if (isSelected) {
        return prev.filter(u => u.userId !== user.userId);
      } else {
        return [...prev, user];
      }
    });
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
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800">Department Statistics</Text>
            {isHODOrKaryalay && (
              <TouchableOpacity
                onPress={() => setShowCreateSubdeptModal(true)}
                className="bg-blue-600 px-3 py-1 rounded-lg"
              >
                <Text className="text-white text-sm font-medium">+ Subdepartment</Text>
              </TouchableOpacity>
            )}
          </View>
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
            <View className="items-center">
              <Text className="text-3xl font-bold text-purple-600">
                {subdepartments.length}
              </Text>
              <Text className="text-gray-600 text-sm">Subdepartments</Text>
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

        {/* Subdepartments Section */}
        {subdepartments.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons name="business" size={24} color="#8B5CF6" />
              <Text className="text-lg font-bold text-gray-800 ml-2">
                Subdepartments ({subdepartments.length})
              </Text>
            </View>
            {subdepartments.map((subdept) => (
              <View key={subdept.subdepartmentId} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-800">{subdept.subdepartmentName}</Text>
                    <Text className="text-gray-500 text-sm">
                      {subdept.userList.length} members • Created {new Date(subdept.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {isHODOrKaryalay && (
                    <TouchableOpacity
                      onPress={() => handleDeleteSubdepartment(subdept)}
                      className="p-2"
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
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

      {/* Create Subdepartment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCreateSubdeptModal}
        onRequestClose={() => setShowCreateSubdeptModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl px-6 py-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-800">Create Subdepartment</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateSubdeptModal(false);
                  setNewSubdeptName('');
                  setSelectedSubdeptUsers([]);
                }}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Subdepartment Name */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-800 mb-3">Subdepartment Name</Text>
                <TextInput
                  value={newSubdeptName}
                  onChangeText={setNewSubdeptName}
                  placeholder="Enter subdepartment name"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800"
                />
              </View>

              {/* User Selection */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-800 mb-3">
                  Select Users ({selectedSubdeptUsers.length} selected)
                </Text>
                {departmentUsers.map((user) => {
                  const isSelected = selectedSubdeptUsers.some(u => u.userId === user.userId);
                  return (
                    <TouchableOpacity
                      key={user.userId}
                      onPress={() => toggleUserSelection(user)}
                      className={`p-4 border-b border-gray-100 ${isSelected ? 'bg-blue-50' : ''}`}
                    >
                      <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
                          <Text className="text-blue-600 font-semibold">
                            {user.fullName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        
                        <View className="flex-1">
                          <Text className="font-semibold text-gray-800">{user.fullName}</Text>
                          <Text className="text-gray-500 text-sm">{user.mobileNumber}</Text>
                        </View>

                        <Ionicons 
                          name={isSelected ? "checkmark-circle" : "radio-button-off"} 
                          size={24} 
                          color={isSelected ? "#10B981" : "#6B7280"} 
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Create Button */}
              <CustomButton
                title={isCreatingSubdept ? 'Creating...' : 'Create Subdepartment'}
                onPress={handleCreateSubdepartment}
                disabled={isCreatingSubdept || !newSubdeptName.trim() || selectedSubdeptUsers.length === 0}
                loading={isCreatingSubdept}
                bgVariant="primary"
                className="h-14 rounded-xl"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
} 