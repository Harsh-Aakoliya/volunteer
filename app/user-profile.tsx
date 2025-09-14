// app/user-profile.tsx
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { getUserProfileById, fetchSabhaAttendanceForUser } from '@/api/user';
import UserProfile from '@/components/UserProfile';
import { ActivityIndicator, View, Text, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function UserProfilePage() {
  const { userData } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadUserData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const userFromParams = JSON.parse(userData as string);
      const freshUserData = await getUserProfileById(userFromParams.userId);
      setUser(freshUserData);
      
      // Fetch attendance data for the user
      const attendanceRecords = await fetchSabhaAttendanceForUser(userFromParams.userId);
      setAttendanceData(attendanceRecords);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadUserData(true);
  };

  const handleEdit = () => {
    router.push({
      pathname: '/edit-user',
      params: {
        userData: JSON.stringify(user)
      }
    });
  };

  useEffect(() => {
    if (userData) {
      loadUserData();
    }
  }, [userData]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50">
        <LinearGradient colors={['#0286ff', '#0255ff']} className="pt-4 pb-6 px-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold text-white">User Profile</Text>
          </View>
        </LinearGradient>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0286ff" />
          <Text className="text-gray-600 mt-2">Loading user data...</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-gray-50">
        <LinearGradient colors={['#0286ff', '#0255ff']} className="pt-4 pb-6 px-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold text-white">User Profile</Text>
          </View>
        </LinearGradient>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-600">User not found</Text>
        </View>
      </View>
    );
  }

  return (
    <UserProfile 
      user={user} 
      onEdit={handleEdit}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      attendanceData={attendanceData}
    />
  );
}
