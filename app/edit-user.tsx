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
  BackHandler
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import CustomButton from '@/components/ui/CustomButton';

export default function EditUserScreen() {
  const { userData } = useLocalSearchParams();
  const [originalUser, setOriginalUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [formValidation, setFormValidation] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data
  useEffect(() => {
    if (userData) {
      const user = JSON.parse(userData as string);
      setOriginalUser(user);
      
      // Convert date format from YYYY-MM-DD to DD-MM-YYYY for display
      const formattedDOB = user.dateOfBirth ? 
        formatDateForDisplay(user.dateOfBirth) : '';
      
      const formData = {
        userId: user.userId || '',
        mobileNumber: user.mobileNumber || '',
        fullName: user.fullName || '',
        isAdmin: user.isAdmin || false,
        gender: user.gender || '',
        dateOfBirth: formattedDOB,
        bloodGroup: user.bloodGroup || '',
        maritalStatus: user.maritalStatus || '',
        education: user.education || '',
        whatsappNumber: user.whatsappNumber || '',
        emergencyContact: user.emergencyContact || '',
        email: user.email || '',
        address: user.address || '',
      };
      
      setEditFormData(formData);
      
      // Initialize validation - only for DOB
      setFormValidation({
        dateOfBirth: true,
      });
    }
  }, [userData]);

  // Check for changes whenever form data changes
  useEffect(() => {
    if (originalUser) {
      const originalFormattedDOB = originalUser.dateOfBirth ? 
        formatDateForDisplay(originalUser.dateOfBirth) : '';
      
      const originalFormData = {
        userId: originalUser.userId || '',
        mobileNumber: originalUser.mobileNumber || '',
        fullName: originalUser.fullName || '',
        isAdmin: originalUser.isAdmin || false,
        gender: originalUser.gender || '',
        dateOfBirth: originalFormattedDOB,
        bloodGroup: originalUser.bloodGroup || '',
        maritalStatus: originalUser.maritalStatus || '',
        education: originalUser.education || '',
        whatsappNumber: originalUser.whatsappNumber || '',
        emergencyContact: originalUser.emergencyContact || '',
        email: originalUser.email || '',
        address: originalUser.address || '',
      };

      const hasChanges = JSON.stringify(originalFormData) !== JSON.stringify(editFormData);
      setHasChanges(hasChanges);
    }
  }, [editFormData, originalUser]);

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

  // Date formatting functions
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatDateForStorage = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }
    return dateString;
  };

  // Validation functions
  const validateDateOfBirth = (dateString: string) => {
    if (!dateString) return true;
    const parts = dateString.split('-');
    if (parts.length !== 3) return false;
    const [day, month, year] = parts.map(part => parseInt(part));
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  };

  // Update validation state
  const updateValidation = (field: string, value: string) => {
    let isValid = true;
    
    if (field === 'dateOfBirth') {
      isValid = validateDateOfBirth(value);
    }
    
    setFormValidation((prev: any) => ({ ...prev, [field]: isValid }));
  };

  // Save user changes
  const handleSaveUser = async () => {
    try {
      // Validate DOB format before saving
      if (editFormData.dateOfBirth && !validateDateOfBirth(editFormData.dateOfBirth)) {
        Alert.alert(
          'Invalid Date Format',
          'Please enter Date of Birth in DD-MM-YYYY format',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const token = await AuthStorage.getToken();
      
      // Format DOB for storage
      const formattedFormData = {
        ...editFormData,
        dateOfBirth: formatDateForStorage(editFormData.dateOfBirth)
      };
      
      const response = await fetch(`${API_URL}/api/users/update/${originalUser.userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedFormData),
      });

      if (response.ok) {
        Alert.alert('Success', 'User updated successfully', [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Error', 'Failed to update user');
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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color="#666" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Edit User</Text>
        <View className="w-6" />
      </View>
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Mobile Number */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Mobile Number</Text>
            <TextInput
              value={editFormData.mobileNumber}
              onChangeText={(text) => {
                setEditFormData((prev: any) => ({ ...prev, mobileNumber: text }));
              }}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter mobile number"
              keyboardType="phone-pad"
            />
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
            <View className="flex-row items-center">
              <TextInput
                value={editFormData.dateOfBirth}
                onChangeText={(text) => {
                  setEditFormData((prev: any) => ({ ...prev, dateOfBirth: text }));
                  updateValidation('dateOfBirth', text);
                }}
                className="flex-1 bg-white p-3 rounded-lg border border-gray-200"
                placeholder="DD-MM-YYYY"
              />
              {formValidation.dateOfBirth && (
                <Ionicons name="checkmark-circle" size={20} color="#10B981" className="ml-2" />
              )}
            </View>
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
            <TextInput
              value={editFormData.whatsappNumber}
              onChangeText={(text) => {
                setEditFormData((prev: any) => ({ ...prev, whatsappNumber: text }));
              }}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter WhatsApp number"
              keyboardType="phone-pad"
            />
          </View>

          {/* Emergency Contact */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Emergency Contact</Text>
            <TextInput
              value={editFormData.emergencyContact}
              onChangeText={(text) => {
                setEditFormData((prev: any) => ({ ...prev, emergencyContact: text }));
              }}
              className="bg-white p-3 rounded-lg border border-gray-200"
              placeholder="Enter emergency contact"
              keyboardType="phone-pad"
            />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
            <TextInput
              value={editFormData.email}
              onChangeText={(text) => {
                setEditFormData((prev: any) => ({ ...prev, email: text }));
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
            disabled={!hasChanges}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 