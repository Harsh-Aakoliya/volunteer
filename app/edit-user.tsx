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
import { updateUserWithSubdepartments, getSearchFilters } from '@/api/user';
import { SearchFiltersResponse } from '@/types/type';
import CustomButton from '@/components/ui/CustomButton';
import DobPicker from '@/components/chat/DobPicker';
import { LinearGradient } from 'expo-linear-gradient';

export default function EditUserScreen() {
  const { userData } = useLocalSearchParams();
  const [originalUser, setOriginalUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [formValidation, setFormValidation] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedDOB, setSelectedDOB] = useState<Date | null>(null);
  
  // New states for subdepartment functionality
  const [filters, setFilters] = useState<SearchFiltersResponse | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSubdepartments, setSelectedSubdepartments] = useState<string[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  // Load search filters
  const loadFilters = async () => {
    try {
      setIsLoadingFilters(true);
      const filtersData = await getSearchFilters();
      setFilters(filtersData);
    } catch (error) {
      console.error('Error loading filters:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Initialize form data
  useEffect(() => {
    if (userData) {
      const user = JSON.parse(userData as string);
      setOriginalUser(user);
      
      // Set DOB date object for picker
      let dobDate = null;
      if (user.dateOfBirth) {
        dobDate = new Date(user.dateOfBirth);
        // If invalid date, set to current date
        if (isNaN(dobDate.getTime())) {
          dobDate = new Date();
        }
      } else {
        // If no DOB, set to current date
        dobDate = new Date();
      }
      setSelectedDOB(dobDate);
      
      const formData = {
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
      };
      
      setEditFormData(formData);
      
      // Set department and subdepartments
      setSelectedDepartment(user.departmentId || '');
      setSelectedSubdepartments(user.subdepartmentIds || []);
      
      // Initialize validation - only for DOB
      setFormValidation({
        dateOfBirth: true,
      });
    }
    
    // Load filters
    loadFilters();
  }, [userData]);

  // Check for changes whenever form data changes
  useEffect(() => {
    if (originalUser) {
      const originalFormData = {
        userId: originalUser.userId || '',
        mobileNumber: originalUser.mobileNumber || '',
        fullName: originalUser.fullName || '',
        isAdmin: originalUser.isAdmin || false,
        gender: originalUser.gender || '',
        dateOfBirth: originalUser.dateOfBirth || '',
        bloodGroup: originalUser.bloodGroup || '',
        maritalStatus: originalUser.maritalStatus || '',
        education: originalUser.education || '',
        whatsappNumber: originalUser.whatsappNumber || '',
        emergencyContact: originalUser.emergencyContact || '',
        email: originalUser.email || '',
        address: originalUser.address || '',
      };

      const formChanges = JSON.stringify(originalFormData) !== JSON.stringify(editFormData);
      const deptChanges = (originalUser.departmentId || '') !== selectedDepartment;
      const subdeptChanges = JSON.stringify(originalUser.subdepartmentIds || []) !== JSON.stringify(selectedSubdepartments);
      
      setHasChanges(formChanges || deptChanges || subdeptChanges);
    }
  }, [editFormData, originalUser, selectedDepartment, selectedSubdepartments]);

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
    if (date) {
      // Format date as YYYY-MM-DD for storage
      const formattedDate = date.toISOString().split('T')[0];
      setEditFormData((prev: any) => ({ ...prev, dateOfBirth: formattedDate }));
    }
  };

  // Handle department selection
  const handleDepartmentChange = (departmentId: string) => {
    setSelectedDepartment(departmentId);
    // Clear subdepartments when department changes
    setSelectedSubdepartments([]);
  };

  // Handle subdepartment selection
  const toggleSubdepartment = (subdepartmentId: string) => {
    setSelectedSubdepartments(prev => 
      prev.includes(subdepartmentId)
        ? prev.filter(id => id !== subdepartmentId)
        : [...prev, subdepartmentId]
    );
  };

  // Get filtered subdepartments based on selected department
  const getFilteredSubdepartments = () => {
    if (!filters || !selectedDepartment) return [];
    
    return filters.subdepartments.filter(sub => 
      sub.departmentId === selectedDepartment
    );
  };

  // Save user changes
  const handleSaveUser = async () => {
    try {
      // Prepare the data for the new API
      const updateData = {
        ...editFormData,
        departmentId: selectedDepartment,
        subdepartmentIds: selectedSubdepartments
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
          {editFormData.fullName || 'User Profile'}
        </Text>
      </LinearGradient>
      
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

          {/* Department Selection - Only for Karyalay users */}
          {filters?.userRole.isKaryalay && (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Department</Text>
              <View className="bg-white rounded-lg border border-gray-200">
                <TouchableOpacity
                  onPress={() => {
                    setSelectedDepartment('');
                    setSelectedSubdepartments([]);
                  }}
                  className={`p-3 border-b border-gray-100 ${!selectedDepartment ? 'bg-blue-50' : ''}`}
                >
                  <Text className={`${!selectedDepartment ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                    No Department
                  </Text>
                </TouchableOpacity>
                
                {filters.departments.map((dept) => (
                  <TouchableOpacity
                    key={dept.departmentId}
                    onPress={() => handleDepartmentChange(dept.departmentId)}
                    className={`p-3 border-b border-gray-100 last:border-b-0 ${
                      selectedDepartment === dept.departmentId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <Text className={`${
                      selectedDepartment === dept.departmentId ? 'text-blue-600 font-medium' : 'text-gray-700'
                    }`}>
                      {dept.departmentName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Subdepartment Selection */}
          {getFilteredSubdepartments().length > 0 && (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Subdepartments {selectedSubdepartments.length > 0 && `(${selectedSubdepartments.length} selected)`}
              </Text>
              <View className="bg-white rounded-lg border border-gray-200 p-3">
                {getFilteredSubdepartments().map((subdept) => {
                  const isSelected = selectedSubdepartments.includes(subdept.subdepartmentId);
                  return (
                    <TouchableOpacity
                      key={subdept.subdepartmentId}
                      onPress={() => toggleSubdepartment(subdept.subdepartmentId)}
                      className="flex-row items-center justify-between py-2"
                    >
                      <Text className={`flex-1 ${isSelected ? 'text-purple-600 font-medium' : 'text-gray-700'}`}>
                        {subdept.subdepartmentName}
                      </Text>
                      <View className={`w-5 h-5 rounded border-2 items-center justify-center ${
                        isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={12} color="white" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {selectedSubdepartments.length > 0 && (
                <View className="mt-2">
                  <Text className="text-xs text-gray-500">
                    Selected: {selectedSubdepartments.map(id => {
                      const subdept = getFilteredSubdepartments().find(s => s.subdepartmentId === id);
                      return subdept?.subdepartmentName;
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
              <View className="flex-1">
                <DobPicker
                  selectedDate={selectedDOB}
                  setSelectedDate={handleDOBChange}
                  dateButtonClassName="bg-white"
                />
              </View>
              <TouchableOpacity className="ml-3 p-2">
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
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