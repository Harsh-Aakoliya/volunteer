// app/user-profile.tsx
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { getUserProfileById } from '@/api/user';
import { AuthStorage } from '@/utils/authStorage';
import UserProfile from '@/components/UserProfile';
import { ActivityIndicator, View, Text, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Generate dummy attendance data
const generateDummyAttendanceData = () => {
  const data = [];
  const today = new Date();
  
  // Generate last 10 sabha attendance records
  for (let i = 0; i < 10; i++) {
    const sabhaDate = new Date(today);
    sabhaDate.setDate(today.getDate() - (i * 7)); // One week apart
    
    const isPresent = Math.random() > 0.2; // 80% present rate
    const isLate = isPresent && Math.random() > 0.7; // 30% late rate if present
    
    let entryTime = null;
    let timeDifference = null;
    
    if (isPresent) {
      if (isLate) {
        // Late entry: between 9:05 AM and 9:30 AM
        const minutesLate = Math.floor(Math.random() * 25) + 5;
        entryTime = `09:${String(minutesLate).padStart(2, '0')}:00`;
        timeDifference = `${minutesLate}min`;
      } else {
        // On time: between 8:45 AM and 9:00 AM
        const minutesEarly = Math.floor(Math.random() * 15);
        const hour = 8;
        const minute = 45 + minutesEarly;
        entryTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        timeDifference = minutesEarly > 0 ? `${minutesEarly}min before` : 'On time';
      }
    }
    
    data.push({
      sabhaDate: sabhaDate.toISOString().split('T')[0],
      entryTime,
      isPresent,
      isLate,
      timeDifference,
    });
  }
  
  return data;
};

export default function UserProfilePage() {
  const { userData } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  // Get current logged-in user's role to determine edit button visibility
  useEffect(() => {
    const checkCurrentUserRole = async () => {
      try {
        const currentUser = await AuthStorage.getUser();
        const role = currentUser?.role || '';
        setCurrentUserRole(role);
      } catch (error) {
        console.error('Error checking current user role:', error);
      }
    };
    checkCurrentUserRole();
  }, []);

  const loadUserData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      let targetUserId: string;
      
      // Check if userData is provided (from dashboard) or use current user (from drawer)
      if (userData) {
        const userFromParams = JSON.parse(userData as string);
        targetUserId = userFromParams.userId;
      } else {
        // No userData provided, load current logged-in user
        const currentUser = await AuthStorage.getUser();
        if (!currentUser || !currentUser.userId) {
          Alert.alert('Error', 'User not found');
          router.back();
          return;
        }
        targetUserId = currentUser.userId;
      }
      
      // Fetch user profile
      const freshUserData = await getUserProfileById(targetUserId);
      setUser(freshUserData);
      
      // Use dummy attendance data instead of API call
      const dummyAttendance = generateDummyAttendanceData();
      setAttendanceData(dummyAttendance);
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
    loadUserData();
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

  // Show edit button only if current user is master or admin
  const showEditButton = currentUserRole === 'master' || currentUserRole === 'admin';

  return (
    <UserProfile 
      user={user} 
      onEdit={handleEdit}
      onRefresh={handleRefresh}
      showEditButton={showEditButton}
      isRefreshing={isRefreshing}
      attendanceData={attendanceData}
    />
  );
}
