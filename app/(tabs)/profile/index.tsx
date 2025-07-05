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
  FlatList
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
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [formValidation, setFormValidation] = useState<any>({});
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

        // Fetch attendance data
        const attendanceRecords = await fetchSabhaAttendance();
        setAttendanceData(attendanceRecords);
        console.log("attendance data", attendanceRecords);
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

  // Fetch all users for search
  const fetchAllUsers = async () => {
    try {
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/users/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);
        setFilteredUsers(users);
      } else {
        Alert.alert('Error', 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    }
  };

  // Search users
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredUsers(allUsers);
    } else {
      const filtered = allUsers.filter(user => 
        user.fullName?.toLowerCase().includes(query.toLowerCase()) ||
        user.mobileNumber?.includes(query)
      );
      setFilteredUsers(filtered);
    }
  };

  // Validation functions
  const validateUserId = (userId: string) => {
    const existingUser = allUsers.find(user => user.userId === userId && user.userId !== editingUser?.userId);
    return !existingUser;
  };

  const validateMobileNumber = (number: string) => {
    return /^\d{10}$/.test(number);
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Update validation state
  const updateValidation = (field: string, value: string) => {
    let isValid = true;
    
    switch (field) {
      case 'userId':
        isValid = validateUserId(value) && value.trim() !== '';
        break;
      case 'mobileNumber':
      case 'whatsappNumber':
      case 'emergencyContact':
        isValid = validateMobileNumber(value);
        break;
      case 'email':
        isValid = value === '' || validateEmail(value);
        break;
      default:
        isValid = true;
    }
    
    setFormValidation((prev: any) => ({ ...prev, [field]: isValid }));
  };

  // Handle edit user
  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditFormData({
      userId: user.userId || '',
      mobileNumber: user.mobileNumber || '',
      fullName: user.fullName || '',
      isAdmin: user.isAdmin || false,
      gender: user.gender || '',
      dateOfBirth: user.dateOfBirth || '',
      bloodGroup: user.bloodGroup || '',
      maritalStatus: user.maritalStatus || '',
      education: user.education || '',
      whatsappNumber: user.whatsappNumber || '',
      emergencyContact: user.emergencyContact || '',
      email: user.email || '',
      address: user.address || '',
    });
    
    // Initialize validation
    setFormValidation({
      userId: true,
      mobileNumber: validateMobileNumber(user.mobileNumber || ''),
      whatsappNumber: validateMobileNumber(user.whatsappNumber || ''),
      emergencyContact: validateMobileNumber(user.emergencyContact || ''),
      email: user.email ? validateEmail(user.email) : true,
    });
    
    setSearchModalVisible(false);
    setEditModalVisible(true);
  };

  // Save user changes
  const handleSaveUser = async () => {
    try {
      const token = await AuthStorage.getToken();
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/users/update/${editingUser.userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        Alert.alert('Success', 'User updated successfully');
        setEditModalVisible(false);
        fetchAllUsers(); // Refresh the users list
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Error', 'Failed to update user');
    }
  };

  // Handle search user option
  const handleSearchUser = () => {
    setMenuVisible(false);
    fetchAllUsers();
    setSearchModalVisible(true);
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

  // User Search Modal Component
  const UserSearchModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={searchModalVisible}
      onRequestClose={() => setSearchModalVisible(false)}
    >
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
          <Text className="text-lg font-bold text-gray-800">Search Users</Text>
          <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        
        <View className="p-4">
          <View className="flex-row items-center bg-white rounded-lg px-4 py-3 border border-gray-200">
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              placeholder="Search by name or mobile number..."
              className="flex-1 ml-3 text-gray-800"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
        </View>
        
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <View className="bg-white mx-4 mb-2 rounded-lg p-4 border border-gray-200">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <View className="flex-row items-center mb-2">
                    <Text className="text-lg font-semibold text-gray-800">{item.fullName}</Text>
                    {item.isAdmin && (
                      <View className="ml-2 bg-blue-100 px-2 py-1 rounded-full">
                        <Text className="text-xs font-bold text-blue-600">ADMIN</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-gray-600 mb-1">📞 {item.mobileNumber}</Text>
                  <Text className="text-gray-600 mb-1">🆔 {item.userId}</Text>
                  <Text className="text-gray-600">{item.department || 'No Department'}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleEditUser(item)}
                  className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center"
                >
                  <Ionicons name="create-outline" size={20} color="#0286ff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </Modal>
  );

  // User Edit Modal Component
  const UserEditModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={editModalVisible}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
          <Text className="text-lg font-bold text-gray-800">Edit User</Text>
          <TouchableOpacity onPress={() => setEditModalVisible(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            {/* User ID */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">User ID</Text>
              <View className="flex-row items-center">
                                 <TextInput
                   value={editFormData.userId}
                   onChangeText={(text) => {
                     setEditFormData((prev: any) => ({ ...prev, userId: text }));
                     updateValidation('userId', text);
                   }}
                   className="flex-1 bg-white p-3 rounded-lg border border-gray-200"
                   placeholder="Enter User ID"
                 />
                {formValidation.userId && (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" className="ml-2" />
                )}
              </View>
            </View>

            {/* Mobile Number */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Mobile Number</Text>
              <View className="flex-row items-center">
                <TextInput
                  value={editFormData.mobileNumber}
                  onChangeText={(text) => {
                    setEditFormData((prev: any) => ({ ...prev, mobileNumber: text }));
                    updateValidation('mobileNumber', text);
                  }}
                  className="flex-1 bg-white p-3 rounded-lg border border-gray-200"
                  placeholder="Enter 10-digit mobile number"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {formValidation.mobileNumber && (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" className="ml-2" />
                )}
              </View>
            </View>

            {/* Full Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Full Name</Text>
              <TextInput
                value={editFormData.fullName}
                onChangeText={(text) => setEditFormData((prev: any) => ({ ...prev, fullName: text }))}
                className="bg-white p-3 rounded-lg border border-gray-200"
                placeholder="Enter full name"
              />
            </View>

            {/* Admin Toggle */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                <Text className="text-sm font-medium text-gray-700">Make Admin</Text>
                <TouchableOpacity
                  onPress={() => setEditFormData((prev: any) => ({ ...prev, isAdmin: !prev.isAdmin }))}
                  className={`w-12 h-6 rounded-full ${editFormData.isAdmin ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <View className={`w-5 h-5 rounded-full bg-white mt-0.5 ${editFormData.isAdmin ? 'ml-6' : 'ml-1'}`} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Gender */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Gender</Text>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => setEditFormData((prev: any) => ({ ...prev, gender: 'male' }))}
                  className={`flex-1 p-3 rounded-lg border mr-2 ${editFormData.gender === 'male' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`text-center ${editFormData.gender === 'male' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>Male</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditFormData((prev: any) => ({ ...prev, gender: 'female' }))}
                  className={`flex-1 p-3 rounded-lg border ml-2 ${editFormData.gender === 'female' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`text-center ${editFormData.gender === 'female' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>Female</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date of Birth */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Date of Birth</Text>
              <TextInput
                value={editFormData.dateOfBirth}
                onChangeText={(text) => setEditFormData((prev: any) => ({ ...prev, dateOfBirth: text }))}
                className="bg-white p-3 rounded-lg border border-gray-200"
                placeholder="YYYY-MM-DD"
              />
            </View>

            {/* Blood Group */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Blood Group</Text>
              <View className="flex-row flex-wrap">
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                  <TouchableOpacity
                    key={group}
                    onPress={() => setEditFormData((prev: any) => ({ ...prev, bloodGroup: group }))}
                    className={`px-3 py-2 rounded-lg border mr-2 mb-2 ${editFormData.bloodGroup === group ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`${editFormData.bloodGroup === group ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>{group}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Marital Status */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Marital Status</Text>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => setEditFormData((prev: any) => ({ ...prev, maritalStatus: 'single' }))}
                  className={`flex-1 p-3 rounded-lg border mr-2 ${editFormData.maritalStatus === 'single' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`text-center ${editFormData.maritalStatus === 'single' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>Single</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditFormData((prev: any) => ({ ...prev, maritalStatus: 'married' }))}
                  className={`flex-1 p-3 rounded-lg border ml-2 ${editFormData.maritalStatus === 'married' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`text-center ${editFormData.maritalStatus === 'married' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>Married</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Education */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Education</Text>
              <TextInput
                value={editFormData.education}
                onChangeText={(text) => setEditFormData((prev: any) => ({ ...prev, education: text }))}
                className="bg-white p-3 rounded-lg border border-gray-200"
                placeholder="Enter education details"
              />
            </View>

            {/* WhatsApp Number */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">WhatsApp Number</Text>
              <View className="flex-row items-center">
                <TextInput
                  value={editFormData.whatsappNumber}
                  onChangeText={(text) => {
                    setEditFormData((prev: any) => ({ ...prev, whatsappNumber: text }));
                    updateValidation('whatsappNumber', text);
                  }}
                  className="flex-1 bg-white p-3 rounded-lg border border-gray-200"
                  placeholder="Enter 10-digit WhatsApp number"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {formValidation.whatsappNumber && (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" className="ml-2" />
                )}
              </View>
            </View>

            {/* Emergency Contact */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Emergency Contact</Text>
              <View className="flex-row items-center">
                <TextInput
                  value={editFormData.emergencyContact}
                  onChangeText={(text) => {
                    setEditFormData((prev: any) => ({ ...prev, emergencyContact: text }));
                    updateValidation('emergencyContact', text);
                  }}
                  className="flex-1 bg-white p-3 rounded-lg border border-gray-200"
                  placeholder="Enter 10-digit emergency contact"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {formValidation.emergencyContact && (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" className="ml-2" />
                )}
              </View>
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
              <TextInput
                value={editFormData.email}
                onChangeText={(text) => {
                  setEditFormData((prev: any) => ({ ...prev, email: text }));
                  updateValidation('email', text);
                }}
                className="bg-white p-3 rounded-lg border border-gray-200"
                placeholder="Enter email address"
                keyboardType="email-address"
              />
            </View>

            {/* Address */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">Address</Text>
              <TextInput
                value={editFormData.address}
                onChangeText={(text) => setEditFormData((prev: any) => ({ ...prev, address: text }))}
                className="bg-white p-3 rounded-lg border border-gray-200"
                placeholder="Enter address"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Save Button */}
            <CustomButton
              title="Save Changes"
              onPress={handleSaveUser}
              className="mb-6"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
                    {userProfile?.department || 'Department'} ({isAdmin? "Admin" : "Sevak"})
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
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {activeTab === 'personal' ? <PersonalInfoTab /> : <AttendanceTab />}
        </ScrollView>
      </View>
      
      <MenuModal />
      <UserSearchModal />
      <UserEditModal />
    </>
  );
}