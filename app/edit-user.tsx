// app/edit-user.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Alert,
  BackHandler,
  ActivityIndicator
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage } from '@/utils/authStorage';
import { updateUserWithSubdepartments, getUserProfileById, getSearchFilters } from '@/api/user';
import { SearchFiltersResponse } from '@/types/type';
import CustomButton from '@/components/ui/CustomButton';
import ModernDatePicker from '@/components/ui/ModernDatePicker';
import { LinearGradient } from 'expo-linear-gradient';

export default function EditUserScreen() {
  const { userData } = useLocalSearchParams();
  
  // State for original and edited data
  const [originalUser, setOriginalUser] = useState<any>(null);
  const [editedUser, setEditedUser] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedDOB, setSelectedDOB] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Department management states
  const [filters, setFilters] = useState<SearchFiltersResponse | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isKaryalay, setIsKaryalay] = useState(false);
  


  // Parse DD/MM/YYYY string to Date
  const parseDDMMYYYYToDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    
    const date = new Date(year, month, day);
    // Check if the date is valid
    if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
      return null;
    }
    
    return date;
  };

  // Format Date to DD/MM/YYYY string
  const formatDateToDDMMYYYY = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Load user data from database
  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const user = JSON.parse(userData as string);
      const freshUserData = await getUserProfileById(user.userId);
      console.log("freshUserData", freshUserData);
      
      // Store original user data (deep copy)
      setOriginalUser(JSON.parse(JSON.stringify(freshUserData)));
      
      // Set DOB date object for picker
      let dobDate = null;
      if (freshUserData.dateOfBirth) {
        dobDate = parseDDMMYYYYToDate(freshUserData.dateOfBirth);
      }
      setSelectedDOB(dobDate);
      
      // Initialize edited user data (this will be manipulated by UI)
      const initialEditData = {
        userId: freshUserData.userId || '',
        mobileNumber: freshUserData.mobileNumber || '',
        fullName: freshUserData.fullName || '',
        isAdmin: freshUserData.isAdmin || false,
        gender: freshUserData.gender || '',
        dateOfBirth: freshUserData.dateOfBirth || '',
        bloodGroup: freshUserData.bloodGroup || '',
        maritalStatus: freshUserData.maritalStatus || '',
        education: freshUserData.education || '',
        whatsappNumber: freshUserData.whatsappNumber || '',
        emergencyContact: freshUserData.emergencyContact || '',
        email: freshUserData.email || '',
        address: freshUserData.address || '',
      };
      
      setEditedUser(initialEditData);
      
      // Set selected departments for HOD management
      setSelectedDepartments(freshUserData.departmentIds || []);
      
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load search filters
  const loadFilters = async () => {
    try {
      setIsLoadingFilters(true);
      const filtersData = await getSearchFilters();
      setFilters(filtersData);
      setIsKaryalay(filtersData.userRole.isKaryalay);
    } catch (error) {
      console.error('Error loading filters:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Initialize form data
  useEffect(() => {
    if (userData) {
      loadUserData();
      loadFilters();
    }
  }, [userData]);

  // Check for changes whenever form data changes
  useEffect(() => {
    if (originalUser && editedUser) {
      // Compare all form fields
      const formChanges = (
        originalUser.mobileNumber !== editedUser.mobileNumber ||
        originalUser.fullName !== editedUser.fullName ||
        originalUser.isAdmin !== editedUser.isAdmin ||
        originalUser.gender !== editedUser.gender ||
        originalUser.dateOfBirth !== editedUser.dateOfBirth ||
        originalUser.bloodGroup !== editedUser.bloodGroup ||
        originalUser.maritalStatus !== editedUser.maritalStatus ||
        originalUser.education !== editedUser.education ||
        originalUser.whatsappNumber !== editedUser.whatsappNumber ||
        originalUser.emergencyContact !== editedUser.emergencyContact ||
        originalUser.email !== editedUser.email ||
        originalUser.address !== editedUser.address
      );
      
      // Compare department changes
      const originalDepts = originalUser.departmentIds || [];
      const selectedDepts = selectedDepartments || [];
      const deptChanges = JSON.stringify(originalDepts.sort()) !== JSON.stringify(selectedDepts.sort());
      
      setHasChanges(formChanges || deptChanges);
    }
  }, [editedUser, originalUser, selectedDepartments]);

  // Handle back button
  useEffect(() => {
    const backAction = () => {
      if (hasChanges) {
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved changes. What would you like to do?",
          [
            {
              text: "Discard Changes",
              style: "destructive",
              onPress: () => router.back()
            },
            {
              text: "Save Changes",
              onPress: async () => {
                await handleSaveUser();
                router.back();
              }
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        );
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [hasChanges]);

  // Handle DOB picker change
  const handleDOBChange = (date: Date | null) => {
    setSelectedDOB(date);
    const formattedDate = formatDateToDDMMYYYY(date);
    setEditedUser((prev: any) => ({ ...prev, dateOfBirth: formattedDate }));
  };

  // Handle field changes
  const handleFieldChange = (field: string, value: any) => {
    setEditedUser((prev: any) => ({ ...prev, [field]: value }));
  };

  // Handle department selection for HOD management
  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartments(prev => 
      prev.includes(departmentId)
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId]
    );
  };

  // Handle HOD toggle - clear departments when HOD is turned off
  const handleHODToggle = () => {
    const newIsAdmin = !editedUser.isAdmin;
    setEditedUser((prev: any) => ({ ...prev, isAdmin: newIsAdmin }));
    
    // Clear department selections when HOD is turned off
    if (!newIsAdmin) {
      setSelectedDepartments([]);
    }
  };

  // Save user changes
  const handleSaveUser = async () => {
    try {
      setIsSaving(true);
      
      // Prepare the data for the API
      const updateData = {
        ...editedUser,
        departmentIds: selectedDepartments
      };

      await updateUserWithSubdepartments(originalUser.userId, updateData);
      
      Alert.alert('Success', 'User updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ]);
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Error', 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle back button press
  const handleBackPress = () => {
    if (hasChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. What would you like to do?",
        [
          {
            text: "Discard Changes",
            style: "destructive",
            onPress: () => router.back()
          },
          {
            text: "Save Changes",
            onPress: async () => {
              await handleSaveUser();
              router.back();
            }
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
    } else {
      router.back();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <LinearGradient colors={['#0286ff', '#0255ff']} className="pt-4 pb-6 px-6">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handleBackPress}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-white">Edit User</Text>
            <View className="w-10" />
          </View>
        </LinearGradient>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0286ff" />
          <Text className="text-gray-600 mt-2">Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient colors={['#0286ff', '#0255ff']} className="pt-4 pb-6 px-6">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={handleBackPress}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white">Edit User</Text>
          <View className="w-10" />
        </View>
        
        <Text className="text-white/80 text-center mt-2">
          {editedUser.fullName || 'User Profile'}
        </Text>
      </LinearGradient>
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Mobile Number */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Mobile Number</Text>
            <TextInput
              value={editedUser.mobileNumber}
              onChangeText={(text) => handleFieldChange('mobileNumber', text)}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter mobile number"
              keyboardType="phone-pad"
            />
          </View>

          {/* Full Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Full Name</Text>
            <TextInput
              value={editedUser.fullName}
              onChangeText={(text) => handleFieldChange('fullName', text)}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter full name"
            />
          </View>

           {/* Admin Toggle */}
           <View className="mb-4">
             <View className="flex-row items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
               <Text className="text-sm font-medium text-gray-700">Make HOD</Text>
               <TouchableOpacity
                 onPress={handleHODToggle}
                 className={`w-12 h-6 rounded-full ${editedUser.isAdmin ? 'bg-blue-500' : 'bg-gray-300'}`}
               >
                 <View className={`w-5 h-5 rounded-full bg-white mt-0.5 ${editedUser.isAdmin ? 'ml-6' : 'ml-1'}`} />
               </TouchableOpacity>
             </View>
           </View>

           {/* Department Management - Only for Karyalay users */}
           {isKaryalay && (
             <View className="mb-4">
               <Text className="text-sm font-medium text-gray-700 mb-2">
                 Department Management {selectedDepartments.length > 0 && `(${selectedDepartments.length} selected)`}
               </Text>
               <Text className="text-xs text-gray-500 mb-3">
                 Select departments this user belongs to. {editedUser.isAdmin ? 'As HOD, user will be in both user list and HOD list.' : 'User will be added to user list only.'}
               </Text>
               <View className="bg-white rounded-lg border border-gray-200 p-3">
                 {filters?.departments.map((dept) => {
                   const isSelected = selectedDepartments.includes(dept.departmentId);
                   return (
                     <TouchableOpacity
                       key={dept.departmentId}
                       onPress={() => toggleDepartment(dept.departmentId)}
                       className="flex-row items-center justify-between py-2"
                     >
                       <Text className={`flex-1 ${isSelected ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                         {dept.departmentName}
                       </Text>
                       <View className={`w-5 h-5 rounded border-2 items-center justify-center ${
                         isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                       }`}>
                         {isSelected && (
                           <Ionicons name="checkmark" size={12} color="white" />
                         )}
                       </View>
                     </TouchableOpacity>
                   );
                 })}
               </View>
               
               {selectedDepartments.length > 0 && (
                 <View className="mt-2">
                   <Text className="text-xs text-gray-500">
                     Selected: {selectedDepartments.map(id => {
                       const dept = filters?.departments.find(d => d.departmentId === id);
                       return dept?.departmentName;
                     }).filter(Boolean).join(', ')}
                   </Text>
                 </View>
               )}
             </View>
           )}


          {/* Gender */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Gender</Text>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => handleFieldChange('gender', 'male')}
                className={`flex-1 p-3 rounded-lg border mr-2 ${editedUser.gender === 'male' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
              >
                <Text className={`text-center ${editedUser.gender === 'male' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleFieldChange('gender', 'female')}
                className={`flex-1 p-3 rounded-lg border ml-2 ${editedUser.gender === 'female' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
              >
                <Text className={`text-center ${editedUser.gender === 'female' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>Female</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date of Birth */}
          <ModernDatePicker
            selectedDate={selectedDOB}
            onDateChange={handleDOBChange}
            label="Date of Birth"
            placeholder="No DOB selected"
            className="mb-4"
          />

          {/* Blood Group */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Blood Group</Text>
            <View className="flex-row flex-wrap">
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                <TouchableOpacity
                  key={group}
                  onPress={() => handleFieldChange('bloodGroup', group)}
                  className={`px-3 py-2 rounded-lg border mr-2 mb-2 ${editedUser.bloodGroup === group ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`${editedUser.bloodGroup === group ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>{group}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Marital Status */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Marital Status</Text>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => handleFieldChange('maritalStatus', 'single')}
                className={`flex-1 p-3 rounded-lg border mr-2 ${editedUser.maritalStatus === 'single' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
              >
                <Text className={`text-center ${editedUser.maritalStatus === 'single' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>Single</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleFieldChange('maritalStatus', 'married')}
                className={`flex-1 p-3 rounded-lg border ml-2 ${editedUser.maritalStatus === 'married' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'}`}
              >
                <Text className={`text-center ${editedUser.maritalStatus === 'married' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>Married</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Education */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Education</Text>
            <TextInput
              value={editedUser.education}
              onChangeText={(text) => handleFieldChange('education', text)}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter education details"
            />
          </View>

          {/* WhatsApp Number */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">WhatsApp Number</Text>
            <TextInput
              value={editedUser.whatsappNumber}
              onChangeText={(text) => handleFieldChange('whatsappNumber', text)}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter WhatsApp number"
              keyboardType="phone-pad"
            />
          </View>

          {/* Emergency Contact */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Emergency Contact</Text>
            <TextInput
              value={editedUser.emergencyContact}
              onChangeText={(text) => handleFieldChange('emergencyContact', text)}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter emergency contact"
              keyboardType="phone-pad"
            />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
            <TextInput
              value={editedUser.email}
              onChangeText={(text) => handleFieldChange('email', text)}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter email address"
              keyboardType="email-address"
            />
          </View>

          {/* Address */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">Address</Text>
            <TextInput
              value={editedUser.address}
              onChangeText={(text) => handleFieldChange('address', text)}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter address"
              multiline
              numberOfLines={3}
            />
          </View>

           {/* Save Button */}
           <CustomButton
             title={isSaving ? "Saving..." : "Save Changes"}
             onPress={handleSaveUser}
             className="mb-6"
             disabled={!hasChanges || isSaving}
             loading={isSaving}
           />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 