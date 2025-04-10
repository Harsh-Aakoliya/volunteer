// app/user/profile.tsx
import { View, Text, ScrollView } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import axios from 'axios';
import CustomButton from '../../components/ui/CustomButton';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../constants/api';
import { getUserProfile,getUserAttendance } from '@/api/auth';

interface AttendanceData {
  year: string;
  starting_month: string;
  ending_month: string;
  total_sabha: number;
  present_count: number;
  absent_count: number;
}

interface UserProfile {
  full_name: string;
  specific_id: string;
  xetra: string;
  mandal: string;
  role: string;
}

export default function UserProfile() {
  const { logout, userToken, userId } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userToken && userId) {
      fetchUserData();
    }
  }, [userToken, userId]);

  const fetchUserData = async () => {
    try {
      const [profileRes, attendanceRes] = await Promise.all([
        getUserProfile(userToken!, userId!),
        getUserAttendance(userToken!, userId!)
      ]);

      setProfile(profileRes);
      setAttendance(attendanceRes);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/');
  }, [logout]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!profile || !attendance) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>No profile data available</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="items-center p-6">
        <View className="w-24 h-24 rounded-full bg-gray-200 mb-4" />
        <Text className="text-xl font-bold">{profile.full_name}</Text>
        <Text className="text-gray-600">{profile.specific_id}</Text>
      </View>

      <View className="px-6">
        <View className="flex-row justify-between mb-6">
          <View className="items-center flex-1">
            <Text className="text-gray-600">Xetra</Text>
            <Text className="font-bold">{profile.xetra}</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-gray-600">Mandal</Text>
            <Text className="font-bold">{profile.mandal}</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-gray-600">Role</Text>
            <Text className="font-bold">{profile.role}</Text>
          </View>
        </View>

        <View className="bg-gray-100 rounded-lg p-4 mb-6">
          <Text className="text-lg font-bold mb-4">Attendance</Text>
          <View className="mb-4">
            <Text className="text-gray-600">Year</Text>
            <Text className="font-bold">{attendance.year}</Text>
          </View>
          <View className="flex-row justify-between mb-4">
            <View>
              <Text className="text-gray-600">Starting Month</Text>
              <Text className="font-bold">{attendance.starting_month}</Text>
            </View>
            <View>
              <Text className="text-gray-600">Ending Month</Text>
              <Text className="font-bold">{attendance.ending_month}</Text>
            </View>
          </View>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-gray-600">Present</Text>
              <Text className="font-bold text-green-600">
                {attendance.present_count} ({((attendance.present_count / attendance.total_sabha) * 100).toFixed(1)}%)
              </Text>
            </View>
            <View>
              <Text className="text-gray-600">Absent</Text>
              <Text className="font-bold text-red-600">
                {attendance.absent_count} ({((attendance.absent_count / attendance.total_sabha) * 100).toFixed(1)}%)
              </Text>
            </View>
          </View>
        </View>

        <CustomButton
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          className="mb-6"
        />
      </View>
    </ScrollView>
  );
}