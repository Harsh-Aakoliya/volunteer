import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Checkbox from 'expo-checkbox';
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import axios from 'axios';

interface Department {
  departmentName: string;
  isSelected: boolean;
}

interface Step3RecipientsProps {
  selectedDepartments: string[];
  onNext: (selectedDepartments: string[]) => void;
  onBack: () => void; // header/hardware back -> alert in wizard
  onPrevious: () => void; // bottom Previous -> no alert
  isEdit?: boolean;
}

export default function Step3Recipients({ 
  selectedDepartments: initialSelectedDepartments,
  onNext, 
  onBack,
  onPrevious,
  isEdit = false
}: Step3RecipientsProps) {
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(initialSelectedDepartments);
  const [searchQuery, setSearchQuery] = useState('');
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [isKaryalay, setIsKaryalay] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const getCurrentUser = async () => {
      const userData = await AuthStorage.getUser();
      console.log("User data in step3recipients" ,userData);
      if (userData) {
        const departments = userData.departments || [];
        const isKaryalayUser = userData?.departments && userData?.departments.includes('Karyalay') || false;
        
        setUserDepartments(departments);
        setIsKaryalay(isKaryalayUser);
        
        console.log("User departments" ,departments);
        console.log("Is Karyalay user" ,isKaryalayUser);
        
        // Load departments after setting user data
        await loadDepartments(departments, isKaryalayUser);
      }
    };
    getCurrentUser();
  }, []);

  // Update selected departments when initial props change
  useEffect(() => {
    console.log('Step3Recipients: Updating selected departments from props:', initialSelectedDepartments);
    setSelectedDepartments(initialSelectedDepartments);
  }, [initialSelectedDepartments]);

  // Debug effect to log current state
  useEffect(() => {
    console.log('Step3Recipients: Current state:', {
      selectedDepartments,
      isEdit,
      initialSelectedDepartments
    });
  }, [selectedDepartments, isEdit, initialSelectedDepartments]);

  // Filter departments based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDepartments(departments);
    } else {
      const filtered = departments.filter(dept => 
        dept.departmentName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDepartments(filtered);
    }
  }, [searchQuery, departments]);

  const loadDepartments = async (userDepts?: string[], isKaryalayUser?: boolean) => {
    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();

      // Use passed parameters or state values
      const currentUserDepartments = userDepts || userDepartments;
      const currentIsKaryalay = isKaryalayUser !== undefined ? isKaryalayUser : isKaryalay;
      
      // Filter departments based on user access level
      let availableDepartments: string[] = [];
      
      if (currentIsKaryalay) {
        // Get all departments
        const response = await axios.get(`${API_URL}/api/announcements/departments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const allDepartments = response.data;
        // Karyalay users can send to all departments
        availableDepartments = allDepartments;
      } else {
        // HOD users can only send to their own departments
        availableDepartments = currentUserDepartments;
        
        // If HOD has no departments, this might be a data issue
        if (availableDepartments.length === 0) {
          console.warn("HOD user has no departments assigned!");
          alert("Warning: You don't have any departments assigned. Please contact administrator.");
        }
      }
      console.log("Available departments" ,availableDepartments);
      console.log("Current user departments" ,currentUserDepartments);
      console.log("Current is Karyalay" ,currentIsKaryalay);

      // Convert to department objects with selection state
      const departmentObjects: Department[] = availableDepartments.map(deptName => ({
        departmentName: deptName,
        isSelected: selectedDepartments.includes(deptName)
      }));

      setDepartments(departmentObjects);
      setFilteredDepartments(departmentObjects);
    } catch (error) {
      console.error('Error loading departments:', error);
      alert('Failed to load departments');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDepartmentSelection = (departmentName: string) => {
    setSelectedDepartments(prev => 
      prev.includes(departmentName)
        ? prev.filter(name => name !== departmentName)
        : [...prev, departmentName]
    );

    // Update the departments state
    setDepartments(prev => prev.map(dept => 
      dept.departmentName === departmentName 
        ? { ...dept, isSelected: !dept.isSelected }
        : dept
    ));
  };

  const selectAllDepartments = () => {
    const allDepartmentNames = filteredDepartments.map(dept => dept.departmentName);
    const allSelected = allDepartmentNames.every(name => selectedDepartments.includes(name));
    
    if (allSelected) {
      // Deselect all filtered departments
      setSelectedDepartments(prev => prev.filter(name => !allDepartmentNames.includes(name)));
    } else {
      // Select all filtered departments
      setSelectedDepartments(prev => [...new Set([...prev, ...allDepartmentNames])]);
    }

    // Update departments state
    setDepartments(prev => prev.map(dept => ({
      ...dept,
      isSelected: allSelected ? false : (filteredDepartments.some(fd => fd.departmentName === dept.departmentName) ? true : dept.isSelected)
    })));
  };

  const handleNext = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    onNext(selectedDepartments);
  };

  const renderDepartmentItem = (department: Department) => {
    const isSelected = selectedDepartments.includes(department.departmentName);

    return (
      <TouchableOpacity
        key={department.departmentName}
        onPress={() => toggleDepartmentSelection(department.departmentName)}
        className={`flex-row items-center p-4 border-b border-gray-100 ${
          isSelected ? 'bg-blue-50' : 'bg-white'
        }`}
      >
        <Checkbox
          value={isSelected}
          onValueChange={() => toggleDepartmentSelection(department.departmentName)}
          className="mr-3"
          color={isSelected ? '#0284c7' : undefined}
        />
        
        <View className="w-12 h-12 rounded-full justify-center items-center mr-3 bg-blue-100">
          <Ionicons name="business" size={24} color="#0284c7" />
        </View>
        
        <View className="flex-1">
          <Text className="text-base font-medium text-gray-800">
            {department.departmentName}
          </Text>
          <Text className="text-sm text-gray-500">
            Department
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isFormValid = selectedDepartments.length > 0;
  const allFilteredSelected = filteredDepartments.length > 0 && 
    filteredDepartments.every(dept => selectedDepartments.includes(dept.departmentName));

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={onBack} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Departments' : 'Select Departments'}
        </Text>
        
        <View className="w-8" />
      </View>

      {/* Removed step indicator */}

      <View className="flex-1">
        {/* Search Bar and Select All */}
        <View className="p-4 bg-white border-b border-gray-200">
          <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-3">
            <Ionicons name="search" size={20} color="#6b7280" />
            <TextInput
              className="flex-1 ml-2 text-base"
              placeholder="Search departments..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Select All Button */}
          {filteredDepartments.length > 1 && (
            <TouchableOpacity
              onPress={selectAllDepartments}
              className="flex-row items-center p-3 bg-gray-50 rounded-lg"
            >
              <View className="mr-3">
                <Checkbox
                  value={allFilteredSelected}
                  onValueChange={selectAllDepartments}
                  color={allFilteredSelected ? '#0284c7' : undefined}
                />
              </View>
              <Text className="text-gray-700 font-medium">
                {allFilteredSelected ? 'Deselect All' : 'Select All'} 
                {searchQuery ? ' (Filtered)' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Department Selector */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#0284c7" />
            <Text className="text-gray-500 mt-2">Loading departments...</Text>
          </View>
        ) : (
          <ScrollView className="flex-1">
            {filteredDepartments.length === 0 ? (
              <View className="justify-center items-center p-8">
                <Ionicons name="business-outline" size={60} color="#d1d5db" />
                <Text className="text-gray-500 mt-4 text-center">
                  {searchQuery.length > 0 
                    ? "No departments match your search" 
                    : "No departments available"}
                </Text>
              </View>
            ) : (
              <View>
                {filteredDepartments.map(department => renderDepartmentItem(department))}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Navigation */}
      <View className="p-4 bg-white border-t border-gray-200">
        {/* Navigation Buttons */}
        <View className="flex-row space-x-4">
          <TouchableOpacity
            onPress={onPrevious}
            disabled={isNavigating}
            className="flex-1 py-3 px-6 rounded-lg border border-gray-300"
          >
            <Text className="text-gray-700 text-center font-semibold">Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleNext}
            disabled={!isFormValid || isNavigating}
            className={`flex-1 py-3 px-6 rounded-lg ${
              isFormValid && !isNavigating
                ? 'bg-blue-600'
                : 'bg-gray-300'
            }`}
          >
            <Text className={`text-center font-semibold ${
              isFormValid && !isNavigating
                ? 'text-white'
                : 'text-gray-500'
            }`}>
              {isNavigating ? 'Loading...' : 'Next: Preview'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}