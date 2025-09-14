// components/UserProfile.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface UserProfileProps {
  user: any;
  onEdit?: () => void;
  showEditButton?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  attendanceData?: any[];
}

const UserProfile: React.FC<UserProfileProps> = ({ 
  user, 
  onEdit, 
  showEditButton = true,
  onRefresh,
  isRefreshing = false,
  attendanceData = []
}) => {
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'attendance'

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      router.push({
        pathname: '/edit-user',
        params: {
          userData: JSON.stringify(user)
        }
      });
    }
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

  const StatCard = ({ title, value, icon, color = "#4F46E5" }: { title: string, value: number, icon: any, color?: string }) => (
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
    const absentCount = (user?.totalSabha || 0) - (user?.presentCount || 0);
    const attendanceRate = user?.totalSabha ? 
      Math.round((user?.presentCount / user?.totalSabha) * 100) : 0;

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
            value={user?.totalSabha || 0}
            icon="calendar"
            color="#0286ff"
          />
          <StatCard 
            title="Present" 
            value={user?.presentCount || 0}
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

  const PersonalInfoTab = () => (
    <View className="px-6 py-6">
      <View className="bg-white rounded-2xl shadow-sm">
        <View className="p-6">
          <Text className="text-lg font-bold text-gray-800 mb-4">Personal Information</Text>
          
          <PersonalInfoField
            icon="person-outline"
            label="Gender"
            value={user?.gender}
          />
          
          <PersonalInfoField
            icon="calendar-outline"
            label="Date of Birth"
            value={user?.dateOfBirth}
          />
          
          <PersonalInfoField
            icon="water-outline"
            label="Blood Group"
            value={user?.bloodGroup}
          />
          
          <PersonalInfoField
            icon="heart-outline"
            label="Marital Status"
            value={user?.maritalStatus}
          />
          
          <PersonalInfoField
            icon="school-outline"
            label="Education"
            value={user?.education}
          />
          
          <PersonalInfoField
            icon="logo-whatsapp"
            label="WhatsApp Number"
            value={user?.whatsappNumber}
            onPress={() => handleWhatsApp(user?.whatsappNumber)}
            color="#25D366"
          />
          
          <PersonalInfoField
            icon="call-outline"
            label="Emergency Contact"
            value={user?.emergencyContact}
            onPress={() => handlePhoneCall(user?.emergencyContact)}
            color="#EF4444"
          />
          
          <PersonalInfoField
            icon="mail-outline"
            label="Email"
            value={user?.email}
          />
          
          <PersonalInfoField
            icon="location-outline"
            label="Address"
            value={user?.address}
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white">
        <LinearGradient
          colors={["#00ace4","#00ace4"]}
          className="pt-6 pb-6 px-6"
        >
          <View className="flex-row items-center justify-center">
            {/* Left side - Profile Info */}
            <View className="flex-row items-center flex-1">
              <View className="w-16 h-16 bg-white/20 rounded-full items-center justify-center mr-4">
                <Text className="text-xl font-bold text-white">
                  {user?.fullName?.charAt(0) || 'U'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-white text-lg font-bold" numberOfLines={1}>
                  {user?.fullName || 'User Name'}
                </Text>
                <Text className="text-white/80 text-sm" numberOfLines={1}>
                  {user?.isAdmin ? "HOD" : "Sevak"} ({user?.departments?.join(', ') || 'No Department Alloted'})
                </Text>
              </View>
            </View>
            
            {/* Right side - Edit Button */}
            {showEditButton && (
              <TouchableOpacity
                onPress={handleEdit}
                className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
              >
                <Ionicons name="create-outline" size={20} color="white" />
              </TouchableOpacity>
            )}
          </View>

          {/* Contact Info - Centered below */}
          <View className="mt-4">
            {/* Mobile Number - Clickable */}
            <TouchableOpacity 
              onPress={() => handlePhoneCall(user?.mobileNumber)}
              className="mb-2"
            >
              <Text className="text-white/90 text-sm">
                📞 {user?.mobileNumber || 'No mobile number'}
              </Text>
            </TouchableOpacity>
            
            {/* User ID */}
            <Text className="text-white/70 text-xs">
              ID: {user?.userId || '-'}
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
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#0284c7"]}
            />
          ) : undefined
        }
      >
         {activeTab === 'personal' ? <PersonalInfoTab /> : <AttendanceTab />}
      </ScrollView>
    </SafeAreaView>
  );
};

export default UserProfile;
