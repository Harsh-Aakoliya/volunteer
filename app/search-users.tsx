// app/search-users.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { searchUsers, getSearchFilters } from '@/api/user';
import { 
  DepartmentUser, 
  SearchUsersResponse, 
  SearchFiltersResponse 
} from '@/types/type';

export default function SearchUsersScreen() {
  const [users, setUsers] = useState<DepartmentUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState<SearchFiltersResponse | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedSubdepartments, setSelectedSubdepartments] = useState<string[]>([]);
  const [showNoSelection, setShowNoSelection] = useState(true);
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Load search filters on component mount
  const loadSearchFilters = async () => {
    try {
      setIsLoading(true);
      const filtersData = await getSearchFilters();
      setFilters(filtersData);
    } catch (error) {
      console.error('Error loading search filters:', error);
      Alert.alert('Error', 'Failed to load search filters');
    } finally {
      setIsLoading(false);
    }
  };

  // Perform user search with filters
  const performSearch = async (resetPage = true) => {
    // Check if any filters are selected
    if (selectedDepartments.length === 0 && selectedSubdepartments.length === 0) {
      setShowNoSelection(true);
      setUsers([]);
      return;
    }

    setShowNoSelection(false);
    
    try {
      setIsSearching(true);
      const page = resetPage ? 1 : pagination.page;
      
      const response = await searchUsers({
        searchQuery: searchQuery.trim(),
        departmentIds: selectedDepartments,
        subdepartmentIds: selectedSubdepartments,
        page,
        limit: pagination.limit
      });

      if (resetPage) {
        setUsers(response.users);
        setPagination(response.pagination);
      } else {
        // Append for pagination
        setUsers(prev => [...prev, ...response.users]);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle text search
  const handleSearchTextChange = (query: string) => {
    setSearchQuery(query);
  };

  // Trigger search when filters change
  useEffect(() => {
    if (filters) {
      performSearch(true);
    }
  }, [selectedDepartments, selectedSubdepartments]);

  // Handle department selection
  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartments(prev => {
      const newSelection = prev.includes(departmentId)
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId];
      
      // If deselecting a department, also deselect its subdepartments
      if (prev.includes(departmentId)) {
        const deptSubdepartments = filters?.subdepartments
          .filter(sub => sub.departmentId === departmentId)
          .map(sub => sub.subdepartmentId) || [];
        
        setSelectedSubdepartments(prevSub => 
          prevSub.filter(id => !deptSubdepartments.includes(id))
        );
      }
      
      return newSelection;
    });
  };

  // Handle subdepartment selection
  const toggleSubdepartment = (subdepartmentId: string) => {
    setSelectedSubdepartments(prev => 
      prev.includes(subdepartmentId)
        ? prev.filter(id => id !== subdepartmentId)
        : [...prev, subdepartmentId]
    );
  };

  // Get filtered subdepartments based on selected departments
  const getFilteredSubdepartments = () => {
    if (!filters) return [];
    
    if (selectedDepartments.length === 0) {
      return filters.subdepartments;
    }
    
    return filters.subdepartments.filter(sub => 
      selectedDepartments.includes(sub.departmentId)
    );
  };

  // Handle edit user
  const handleEditUser = (user: DepartmentUser) => {
    router.push({
      pathname: '/edit-user',
      params: { userData: JSON.stringify(user) }
    });
  };

  // Handle delete user
  const handleDeleteUser = (user: DepartmentUser) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.fullName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Implement delete user API call here
              Alert.alert('Success', 'User deleted successfully');
              performSearch(true); // Refresh the list
            } catch (error) {
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  // Load more users (pagination)
  const loadMore = () => {
    if (pagination.page < pagination.pages && !isSearching) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
      performSearch(false);
    }
  };

  useEffect(() => {
    loadSearchFilters();
  }, []);

  // Trigger search when search text changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters && (selectedDepartments.length > 0 || selectedSubdepartments.length > 0)) {
        performSearch(true);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Render department tab
  const DepartmentTab = ({ department, isSelected, onPress }: {
    department: { departmentId: string, departmentName: string },
    isSelected: boolean,
    onPress: () => void
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 mx-1 rounded-full border ${
        isSelected 
          ? 'bg-blue-600 border-blue-600' 
          : 'bg-white border-gray-300'
      }`}
    >
      <Text className={`text-sm font-medium ${
        isSelected ? 'text-white' : 'text-gray-700'
      }`}>
        {department.departmentName}
      </Text>
    </TouchableOpacity>
  );

  // Render subdepartment tab
  const SubdepartmentTab = ({ subdepartment, isSelected, onPress }: {
    subdepartment: { subdepartmentId: string, subdepartmentName: string },
    isSelected: boolean,
    onPress: () => void
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-1 mx-1 mb-2 rounded-full border ${
        isSelected 
          ? 'bg-purple-600 border-purple-600' 
          : 'bg-white border-gray-300'
      }`}
    >
      <Text className={`text-xs font-medium ${
        isSelected ? 'text-white' : 'text-gray-700'
      }`}>
        {subdepartment.subdepartmentName}
      </Text>
    </TouchableOpacity>
  );

  const renderUserItem = ({ item }: { item: DepartmentUser }) => (
    <View className="bg-white mx-4 mb-3 rounded-xl p-4 shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center mb-2 flex-wrap">
            <Text className="text-lg font-semibold text-gray-800 mr-2">{item.fullName}</Text>
            {item.isAdmin && (
              <View className="bg-green-100 px-2 py-1 rounded-full">
                <Text className="text-xs font-bold text-green-600">ADMIN</Text>
              </View>
            )}
          </View>
          
          <View className="space-y-1">
            <View className="flex-row items-center">
              <Ionicons name="call-outline" size={14} color="#6B7280" />
              <Text className="text-gray-600 text-sm ml-2">{item.mobileNumber}</Text>
            </View>
            
            <View className="flex-row items-center">
              <Ionicons name="card-outline" size={14} color="#6B7280" />
              <Text className="text-gray-600 text-sm ml-2">{item.userId}</Text>
            </View>
            
            <View className="flex-row items-center">
              <Ionicons name="business-outline" size={14} color="#6B7280" />
              <Text className="text-gray-600 text-sm ml-2">{item.department || 'No Department'}</Text>
            </View>

            {item.subdepartments && item.subdepartments.length > 0 && (
              <View className="flex-row items-start mt-2">
                <Ionicons name="layers-outline" size={14} color="#8B5CF6" />
                <View className="flex-1 ml-2">
                  <Text className="text-purple-600 text-xs font-medium">Subdepartments:</Text>
                  <View className="flex-row flex-wrap">
                    {item.subdepartments.map((sub, index) => (
                      <View key={sub.id} className="bg-purple-50 px-2 py-1 rounded mr-1 mt-1">
                        <Text className="text-purple-700 text-xs">{sub.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
        
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => handleEditUser(item)}
            className="w-9 h-9 bg-blue-100 rounded-full items-center justify-center mr-2"
          >
            <Ionicons name="create-outline" size={18} color="#0286ff" />
          </TouchableOpacity>
          
          {filters?.userRole.isKaryalay && (
            <TouchableOpacity
              onPress={() => handleDeleteUser(item)}
              className="w-9 h-9 bg-red-100 rounded-full items-center justify-center"
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#0286ff" />
        <Text className="text-gray-600 mt-2">Loading filters...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient colors={['#0286ff', '#0255ff']} className="pt-4 pb-6 px-6">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white">Advanced Search</Text>
          <View className="w-10" />
        </View>
        
        <Text className="text-white/80 text-center mt-2">
          {filters?.userRole.isKaryalay ? 'Search across all departments' : 'Search in your department'}
        </Text>
      </LinearGradient>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Department Filters */}
        {filters?.userRole.isKaryalay && filters.departments.length > 0 && (
          <View className="bg-white p-4 mb-2">
            <Text className="text-lg font-bold text-gray-800 mb-3">Departments</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => setSelectedDepartments([])}
                  className={`px-4 py-2 mx-1 rounded-full border ${
                    selectedDepartments.length === 0 
                      ? 'bg-gray-600 border-gray-600' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    selectedDepartments.length === 0 ? 'text-white' : 'text-gray-700'
                  }`}>
                    All
                  </Text>
                </TouchableOpacity>
                
                {filters.departments.map((dept) => (
                  <DepartmentTab
                    key={dept.departmentId}
                    department={dept}
                    isSelected={selectedDepartments.includes(dept.departmentId)}
                    onPress={() => toggleDepartment(dept.departmentId)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Subdepartment Filters */}
        {getFilteredSubdepartments().length > 0 && (
          <View className="bg-white p-4 mb-2">
            <Text className="text-lg font-bold text-gray-800 mb-3">Subdepartments</Text>
            <View className="flex-row flex-wrap">
              <TouchableOpacity
                onPress={() => setSelectedSubdepartments([])}
                className={`px-3 py-1 mx-1 mb-2 rounded-full border ${
                  selectedSubdepartments.length === 0 
                    ? 'bg-gray-600 border-gray-600' 
                    : 'bg-white border-gray-300'
                }`}
              >
                <Text className={`text-xs font-medium ${
                  selectedSubdepartments.length === 0 ? 'text-white' : 'text-gray-700'
                }`}>
                  All
                </Text>
              </TouchableOpacity>
              
              {getFilteredSubdepartments().map((subdept) => (
                <SubdepartmentTab
                  key={subdept.subdepartmentId}
                  subdepartment={subdept}
                  isSelected={selectedSubdepartments.includes(subdept.subdepartmentId)}
                  onPress={() => toggleSubdepartment(subdept.subdepartmentId)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View className="bg-white p-4 mb-2">
          <Text className="text-lg font-bold text-gray-800 mb-3">Search</Text>
          <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3">
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              placeholder="Search by name, ID, or mobile number..."
              className="flex-1 ml-3 text-gray-800"
              value={searchQuery}
              onChangeText={handleSearchTextChange}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Selection Instruction */}
        {showNoSelection && (
          <View className="bg-yellow-50 border border-yellow-200 rounded-xl mx-4 p-4 mb-4">
            <View className="flex-row items-center">
              <Ionicons name="information-circle" size={24} color="#F59E0B" />
              <Text className="text-yellow-800 font-medium ml-2 flex-1">
                Select one or more {filters?.userRole.isKaryalay ? 'departments or ' : ''}subdepartments to view users
              </Text>
            </View>
          </View>
        )}

        {/* Results Summary */}
        {!showNoSelection && (
          <View className="bg-white mx-4 mb-2 rounded-xl p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-600">
                Found {pagination.total} users
                {selectedDepartments.length > 0 && ` in ${selectedDepartments.length} department${selectedDepartments.length > 1 ? 's' : ''}`}
                {selectedSubdepartments.length > 0 && ` • ${selectedSubdepartments.length} subdepartment${selectedSubdepartments.length > 1 ? 's' : ''}`}
              </Text>
              {isSearching && <ActivityIndicator size="small" color="#0286ff" />}
            </View>
          </View>
        )}

        {/* Users List */}
        {!showNoSelection && (
          <FlatList
            data={users}
            keyExtractor={(item) => item.userId}
            renderItem={renderUserItem}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.1}
            ListFooterComponent={
              pagination.page < pagination.pages ? (
                <View className="p-4">
                  <TouchableOpacity
                    onPress={loadMore}
                    disabled={isSearching}
                    className="bg-blue-100 py-3 rounded-xl items-center"
                  >
                    {isSearching ? (
                      <ActivityIndicator size="small" color="#0286ff" />
                    ) : (
                      <Text className="text-blue-600 font-medium">Load More Users</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null
            }
            ListEmptyComponent={
              !isSearching && !showNoSelection ? (
                <View className="items-center justify-center p-8">
                  <Ionicons name="person-outline" size={60} color="#d1d5db" />
                  <Text className="text-gray-500 mt-4 text-center text-lg">
                    No users found
                  </Text>
                  <Text className="text-gray-400 text-center mt-2">
                    {searchQuery 
                      ? 'Try adjusting your search or filters' 
                      : 'No users match the selected filters'
                    }
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
} 