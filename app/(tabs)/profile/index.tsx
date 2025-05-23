// app/profile/profile.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Animated, 
  ActivityIndicator 
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '@/components/ui/CustomButton';
import { StatCardProps, User } from '@/types/type';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStorage } from '@/utils/authStorage';
import { fetchUserProfile, logout } from '@/api/user';

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<any>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollY = new Animated.Value(0);


  // Load user and profile data
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const profileData = await fetchUserProfile();
        setUserProfile(profileData);
        setIsAdmin(profileData.isAdmin);
        console.log("profile data",profileData);
        console.log("is admin in profile",isAdmin);
      } catch (error) {
        console.error('Error loading profile data:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
        
        // Redirect to login if there's an authentication issue
        if (error instanceof Error && 
            (error.message.includes('No authentication token') || 
             error.message.includes('No user data found'))) {
          router.replace('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, []);

  const StatCard = ({ title, value, icon, color = "#4F46E5" }: StatCardProps) => (
    <View 
      className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 flex-1 mx-2"
    >
      <View className={`bg-opacity-20 w-12 h-12 rounded-full items-center justify-center mb-3`}
        style={{ backgroundColor: `${color}20` }}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="text-gray-600 text-sm font-medium">{title}</Text>
      <Text className="text-2xl font-bold" style={{ color }}>{value}</Text>
    </View>
  );

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
      <Text className="text-gray-600 text-base">{label}</Text>
      <Text className="font-semibold text-gray-800 text-base">{value}</Text>
    </View>
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-red-500 text-center mb-4">{error}</Text>
        <CustomButton 
          title="Go to Login" 
          onPress={() => router.replace('/login')}
          bgVariant="danger"
        />
      </View>
    );
  }

  return (
    <Animated.ScrollView 
      className="flex-1 bg-gray-50"
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      )}
      scrollEventThrottle={16}
    >
      <LinearGradient
        colors={['#0286ff', '#0255ff']}
        className="pt-14 pb-8 px-6"
      >
        <View className="flex-row justify-between items-center mb-8">
          <Text className="text-3xl font-bold text-white">Profile</Text>
          {isAdmin && (
            <CustomButton
              title="Dashboard"
              onPress={() => router.push("/(admin)/dashboard")}
              bgVariant="outline"
              textVariant="primary"
              className="bg-white/20 backdrop-blur-lg"
            />
          )}
        </View>

        <View className="bg-white p-6 rounded-2xl shadow-lg">
          <View className="flex-row items-center">
            <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mr-4">
              <Text className="text-2xl font-bold text-blue-600">
                {userProfile?.full_name?.charAt(0) || 'U'}
              </Text>
            </View>
            <View>
              <Text className="text-2xl font-bold text-gray-800">{userProfile?.fullName || 'User Name'}</Text>
              <Text className="text-gray-500 text-lg">{userProfile?.role || 'Role'}</Text>
            </View>
          </View>

          <View className="flex-row mt-6 space-x-4">
            <View className="flex-1 bg-blue-50 p-3 rounded-xl flex-row items-center">
              <Ionicons name="call-outline" size={20} color="#0286ff" />
              <Text className="text-blue-600 ml-2 font-medium">{userProfile?.mobileNumber}</Text>
            </View>
            <View className="flex-1 bg-blue-50 p-3 rounded-xl flex-row items-center">
              <Ionicons name="card-outline" size={20} color="#0286ff" />
              <Text className="text-blue-600 ml-2 font-medium">{userProfile?.userId}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Stats */}
      <View className="px-6 py-6">
        <Text className="text-xl font-bold text-gray-800 mb-4">Attendance Overview</Text>
        <View className="flex-row mb-6">
          <StatCard 
            title="Total Sabha" 
            value={userProfile?.total_sabha || 0}
            icon="calendar"
            color="#0286ff"
          />
          <StatCard 
            title="Present" 
            value={userProfile?.present_count || 0}
            icon="checkmark-circle"
            color="#10B981"
          />
          <StatCard 
            title="Absent" 
            value={userProfile?.absent_count || 0}
            icon="close-circle"
            color="#EF4444"
          />
        </View>

        {/* Details */}
        <View className="bg-white rounded-2xl p-6 shadow-lg mb-8">
          <Text className="text-xl font-bold text-gray-800 mb-4">Sabha Details</Text>
          
          <DetailRow label="Year" value={userProfile?.year || '-'} />
          <DetailRow 
            label="Duration" 
            value={`${userProfile?.starting_month || '-'} - ${userProfile?.ending_month || '-'}`} 
          />
          <DetailRow label="Xetra" value={userProfile?.xetra || '-'} />
          <DetailRow label="Mandal" value={userProfile?.mandal || '-'} />
        </View>

        <CustomButton
          title="Logout"
          onPress={handleLogout}
          bgVariant="danger"
          textVariant="primary"
          className="mt-4 h-14 rounded-xl"
          IconRight={() => <Ionicons name="log-out-outline" size={24} color="white" />}
          disabled={false}
          loading={false}
        />
      </View>
    </Animated.ScrollView>
  );
}