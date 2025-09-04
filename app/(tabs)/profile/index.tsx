// app/profile/profile.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Animated, 
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  Alert,
  TextInput,
  SafeAreaView,
  FlatList,
  RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '@/components/ui/CustomButton';
import { StatCardProps, User } from '@/types/type';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStorage } from '@/utils/authStorage';
import { fetchUserProfile, logout, fetchSabhaAttendance } from '@/api/user';
import { API_URL } from '@/constants/api';

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState<any>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'attendance'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollY = new Animated.Value(0);

  // Load user and profile data
  const loadProfileData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const profileData = await fetchUserProfile();
      setUserProfile(profileData);
      setIsAdmin(profileData.isAdmin);
      console.log("profile data",profileData);
      console.log("is admin in profile",isAdmin);

      // Fetch attendance data
      const attendanceRecords = await fetchSabhaAttendance();
      setAttendanceData(attendanceRecords);
      console.log("attendance data", attendanceRecords);
      
      setError(null); // Clear any previous errors
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
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadProfileData(true);
  };

  useEffect(() => {
    loadProfileData();
  }, []);



  // Handle search user option
  const handleSearchUser = () => {
    setMenuVisible(false);
    router.push('/search-users');
  };

  const StatCard = ({ title, value, icon, color = "#4F46E5" }: StatCardProps) => (
    <View className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex-1 mx-1">
      <View className="flex-row items-center justify-between mb-2">
        <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text className="text-3xl font-bold" style={{ color }}>{value}</Text>
      </View>
      <Text className="text-gray-600 text-sm font-medium">{title}</Text>
    </View>
  );

  const InfoChip = ({ icon, text, color = "#0286ff" }: { icon: any, text: string, color?: string }) => (
    <View className="flex-row items-center bg-gray-50 px-3 py-2 rounded-lg mr-2 mb-2">
      <Ionicons name={icon} size={16} color={color} />
      <Text className="text-gray-700 text-sm font-medium ml-2">{text}</Text>
    </View>
  );

  const PersonalInfoField = ({ 
    icon, 
    label, 
    value, 
    onPress, 
    color = "#6B7280" 
  }: { 
    icon: any, 
    label: string, 
    value?: string, 
    onPress?: () => void, 
    color?: string 
  }) => (
    <TouchableOpacity 
      className="flex-row items-center justify-between py-4 border-b border-gray-100"
      onPress={onPress}
      disabled={!onPress}
    >
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-gray-500 text-sm">{label}</Text>
          <Text className="text-gray-800 font-medium">{value || '-'}</Text>
        </View>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );



  const PersonalInfoTab = () => (
    <View className="px-6 py-6">
      <View className="bg-white rounded-2xl shadow-sm">
        <View className="p-6">
          <Text className="text-lg font-bold text-gray-800 mb-4">Personal Information</Text>
          
          <PersonalInfoField
            icon="person-outline"
            label="Gender"
            value={userProfile?.gender}
          />
          
          <PersonalInfoField
            icon="calendar-outline"
            label="Date of Birth"
            value={userProfile?.dateOfBirth}
          />
          
          <PersonalInfoField
            icon="water-outline"
            label="Blood Group"
            value={userProfile?.bloodGroup}
          />
          
          <PersonalInfoField
            icon="heart-outline"
            label="Marital Status"
            value={userProfile?.maritalStatus}
          />
          
          <PersonalInfoField
            icon="school-outline"
            label="Education"
            value={userProfile?.education}
          />
          
          <PersonalInfoField
            icon="logo-whatsapp"
            label="WhatsApp Number"
            value={userProfile?.whatsappNumber}
            onPress={() => handleWhatsApp(userProfile?.whatsappNumber)}
            color="#25D366"
          />
          
          <PersonalInfoField
            icon="call-outline"
            label="Emergency Contact"
            value={userProfile?.emergencyContact}
            onPress={() => handlePhoneCall(userProfile?.emergencyContact)}
            color="#EF4444"
          />
          
          <PersonalInfoField
            icon="mail-outline"
            label="Email"
            value={userProfile?.email}
          />
          
          <PersonalInfoField
            icon="location-outline"
            label="Address"
            value={userProfile?.address}
          />
        </View>
      </View>
    </View>
  );

  const AttendanceEntry = ({ 
    date, 
    month, 
    entryTime, 
    isAbsent, 
    isLate, 
    timeDifference 
  }: { 
    date: string, 
    month: string, 
    entryTime?: string, 
    isAbsent: boolean, 
    isLate: boolean, 
    timeDifference?: string 
  }) => {
    const getBackgroundColor = () => {
      if (isAbsent) return '#FEE2E2'; // Light red
      if (isLate) return '#FEF3C7'; // Light yellow
      return '#D1FAE5'; // Light green
    };

    const getBorderColor = () => {
      if (isAbsent) return '#EF4444'; // Red
      if (isLate) return '#F59E0B'; // Yellow
      return '#10B981'; // Green
    };

    const getStatusText = () => {
      if (isAbsent) return 'Absent';
      if (isLate) return `Late (${timeDifference})`;
      return `On Time (${timeDifference})`;
    };

    return (
      <View className="flex-row items-center py-3 border-b border-gray-100">
        <View 
          className="w-12 h-12 rounded-full items-center justify-center mr-4"
          style={{ 
            backgroundColor: getBackgroundColor(),
            borderWidth: 2,
            borderColor: getBorderColor()
          }}
        >
          <Text className="text-xs font-bold text-gray-700">{date}</Text>
          <Text className="text-xs text-gray-600">{month}</Text>
        </View>
        
        <View className="flex-1">
          <Text className="text-gray-800 font-medium">9:00 AM - 11:00 AM</Text>
          <Text className="text-gray-600 text-sm">
            {isAbsent ? 'No entry recorded' : `Entry: ${entryTime} | ${getStatusText()}`}
          </Text>
        </View>
      </View>
    );
  };

  const AttendanceTab = () => {
    const absentCount = (userProfile?.totalSabha || 0) - (userProfile?.presentCount || 0);
    const attendanceRate = userProfile?.totalSabha ? 
      Math.round((userProfile?.presentCount / userProfile?.totalSabha) * 100) : 0;

    // Process attendance data for display
    const processedAttendanceData = attendanceData.map(record => {
      const sabhaDate = new Date(record.sabhaDate);
      const date = sabhaDate.getDate().toString();
      const month = sabhaDate.toLocaleDateString('en-US', { month: 'short' });
      
      // Format entry time
      const entryTime = record.entryTime ? 
        new Date(`1970-01-01T${record.entryTime}`).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '';

      // Calculate time difference text with proper null checks
      let timeDifferenceText = '';
      if (record.timeDifference && record.isPresent && typeof record.timeDifference === 'string') {
        try {
          const interval = record.timeDifference;
          // Parse PostgreSQL interval format (e.g., "01:33:00" or "00:02:00")
          const timeParts = interval.split(':');
          
          if (timeParts.length >= 2) {
            const hours = parseInt(timeParts[0]) || 0;
            const minutes = parseInt(timeParts[1]) || 0;
            
            if (hours > 0) {
              timeDifferenceText = `${hours}hr ${minutes}min`;
            } else if (minutes > 0) {
              timeDifferenceText = `${minutes}min`;
            } else {
              timeDifferenceText = 'On time';
            }
            
            if (!record.isLate && minutes > 0) {
              timeDifferenceText += ' before';
            }
          }
        } catch (error) {
          console.warn('Error parsing time difference:', error);
          timeDifferenceText = '';
        }
      }

      return {
        date,
        month,
        entryTime,
        isAbsent: !record.isPresent,
        isLate: record.isLate || false,
        timeDifference: timeDifferenceText
      };
    });

    return (
      <View className="px-6 py-6">
        {/* Statistics Row */}
        <View className="flex-row mb-6">
          <StatCard 
            title="Total Sabha" 
            value={userProfile?.totalSabha || 0}
            icon="calendar"
            color="#0286ff"
          />
          <StatCard 
            title="Present" 
            value={userProfile?.presentCount || 0}
            icon="checkmark-circle"
            color="#10B981"
          />
          <StatCard 
            title="Absent" 
            value={absentCount}
            icon="close-circle"
            color="#EF4444"
          />
        </View>

        {/* Attendance List */}
        <View className="bg-white rounded-2xl shadow-sm">
          <View className="p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-800">Sabha Attendance</Text>
              <View className="bg-blue-50 px-3 py-1 rounded-full">
                <Text className="text-blue-600 font-semibold text-sm">{attendanceRate}%</Text>
              </View>
            </View>
            
            <ScrollView className="max-h-96">
              {processedAttendanceData.length > 0 ? (
                processedAttendanceData.map((entry, index) => (
                  <AttendanceEntry
                    key={index}
                    date={entry.date}
                    month={entry.month}
                    entryTime={entry.entryTime}
                    isAbsent={entry.isAbsent}
                    isLate={entry.isLate}
                    timeDifference={entry.timeDifference}
                  />
                ))
              ) : (
                <View className="py-8 items-center">
                  <Text className="text-gray-500">No attendance records found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    await logout();
    router.replace('/login');
  };

  const handleDashboard = () => {
    setMenuVisible(false);
    router.push("/(admin)/dashboard");
  };

  const handleDepartments = () => {
    setMenuVisible(false);
    router.push("/(departments)" as any);
  };

  const handlePhoneCall = (phoneNumber: string) => {
    if (phoneNumber && phoneNumber !== '-') {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert('Error', 'Phone number not available');
    }
  };

  const handleWhatsApp = (phoneNumber: string) => {
    if (phoneNumber && phoneNumber !== '-') {
      Linking.openURL(`whatsapp://send?phone=${phoneNumber}`);
    } else {
      Alert.alert('Error', 'WhatsApp number not available');
    }
  };

  const MenuModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={menuVisible}
      onRequestClose={() => setMenuVisible(false)}
    >
      <Pressable 
        className="flex-1 bg-black/50" 
        onPress={() => setMenuVisible(false)}
      >
        <View className="flex-1 justify-start items-end pt-16 pr-6">
          <View className="bg-white rounded-2xl shadow-lg min-w-[180px] overflow-hidden">
            {isAdmin && (
              <>
                <TouchableOpacity
                  onPress={handleDashboard}
                  className="flex-row items-center px-4 py-4 border-b border-gray-100"
                >
                  <Ionicons name="stats-chart" size={20} color="#0286ff" />
                  <Text className="ml-3 text-gray-800 font-medium">Dashboard</Text>
                </TouchableOpacity>
                {/* Show Departments and Search User only for Karyalay users and actual HODs */}
                {(user?.department === 'Karyalay' || (isAdmin && user?.department !== 'Karyalay')) && (
                  <>
                    <TouchableOpacity
                      onPress={handleDepartments}
                      className="flex-row items-center px-4 py-4 border-b border-gray-100"
                    >
                      <Ionicons name="business" size={20} color="#0286ff" />
                      <Text className="ml-3 text-gray-800 font-medium">Departments</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSearchUser}
                      className="flex-row items-center px-4 py-4 border-b border-gray-100"
                    >
                      <Ionicons name="search" size={20} color="#0286ff" />
                      <Text className="ml-3 text-gray-800 font-medium">Search User</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center px-4 py-4"
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="ml-3 text-gray-800 font-medium">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );

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
    <>
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white">
          <LinearGradient
            colors={["#00ace4","#00ace4"]}
            className="pt-16 pb-6 px-6"
          >
            <View className="flex-row items-center justify-center">
              {/* Left side - Profile Info */}
              <View className="flex-row items-center flex-1">
                <View className="w-16 h-16 bg-white/20 rounded-full items-center justify-center mr-4">
                  <Text className="text-xl font-bold text-white">
                    {userProfile?.fullName?.charAt(0) || userProfile?.full_name?.charAt(0) || 'U'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white text-lg font-bold" numberOfLines={1}>
                    {userProfile?.fullName || userProfile?.full_name || 'User Name'}
                  </Text>
                  <Text className="text-white/80 text-sm" numberOfLines={1}>
                    {userProfile?.department || 'No Department Alloted'} ({isAdmin? "Admin" : "Sevak"})
                  </Text>
                </View>
              </View>
              
              {/* Right side - Menu */}
              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
              >
                <Ionicons name="ellipsis-vertical" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Contact Info - Centered below */}
            <View className="mt-4">
              {/* Mobile Number - Clickable */}
              <TouchableOpacity 
                onPress={() => handlePhoneCall(userProfile?.mobileNumber)}
                className="mb-2"
              >
                <Text className="text-white/90 text-sm">
                  📞 {userProfile?.mobileNumber || 'No mobile number'}
                </Text>
              </TouchableOpacity>
              
              {/* User ID */}
              <Text className="text-white/70 text-xs">
                ID: {userProfile?.userId || '-'}
              </Text>
            </View>
          </LinearGradient>

          {/* Tab Navigation */}
          <View className="flex-row bg-white border-b border-gray-200">
            <TouchableOpacity
              onPress={() => setActiveTab('personal')}
              className={`flex-1 py-4 ${activeTab === 'personal' ? 'border-b-2 border-blue-500' : ''}`}
            >
              <Text className={`text-center font-medium ${
                activeTab === 'personal' ? 'text-blue-500' : 'text-gray-600'
              }`}>
                Personal Info
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setActiveTab('attendance')}
              className={`flex-1 py-4 ${activeTab === 'attendance' ? 'border-b-2 border-blue-500' : ''}`}
            >
              <Text className={`text-center font-medium ${
                activeTab === 'attendance' ? 'text-blue-500' : 'text-gray-600'
              }`}>
                Attendance
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#0284c7"]}
            />
          }
        >
          {activeTab === 'personal' ? <PersonalInfoTab /> : <AttendanceTab />}
        </ScrollView>
      </View>
      
      <MenuModal />
    </>
  );
}