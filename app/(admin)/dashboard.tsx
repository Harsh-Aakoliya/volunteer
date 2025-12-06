// app/admin/dashboard.tsx
import { View, Text, FlatList, RefreshControl, Alert, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import { getAllUsersForDashboard } from "@/api/user";
import { Ionicons } from '@expo/vector-icons';
import React from "react";
import { User } from '@/types/type';

interface UserWithRole extends User {
  role: 'master' | 'admin' | 'sevak';
}

export default function AdminDashboard() {
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Collapsible states
  const [masterExpanded, setMasterExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(true);
  const [sevakExpanded, setSevakExpanded] = useState(true);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const userData = await AuthStorage.getUser();
        const userRole = userData?.role;
        const adminStatus = userRole === 'master' || userRole === 'admin';
        setIsAdmin(adminStatus);
        
        if (!adminStatus) {
          Alert.alert(
            "Access Denied",
            "You don't have admin privileges to access this page.",
            [{ text: "OK", onPress: () => router.replace("/") }]
          );
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        router.replace("/");
      }
    };

    checkAdminStatus();
  }, []);

  // Fetch all users
  useEffect(() => {
    if (isAdmin) {
      fetchAllUsers();
    }
  }, [isAdmin]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(allUsers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allUsers.filter(user =>
      user.fullName?.toLowerCase().includes(query) ||
      user.mobileNumber?.includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, allUsers]);

  const fetchAllUsers = async () => {
    try {
      setIsLoading(true);
      const users = await getAllUsersForDashboard();
      setAllUsers(users as UserWithRole[]);
      setFilteredUsers(users as UserWithRole[]);
    } catch (error) {
      console.error("Error fetching users:", error);
      Alert.alert("Error", "Failed to fetch users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllUsers();
    setRefreshing(false);
  };

  const handleUserPress = (user: UserWithRole) => {
    router.push({
      pathname: '/user-profile',
      params: {
        userData: JSON.stringify(user)
      }
    });
  };

  // Categorize users
  const masterUsers = filteredUsers.filter(u => u.role === 'master');
  const adminUsers = filteredUsers.filter(u => u.role === 'admin');
  const sevakUsers = filteredUsers.filter(u => u.role === 'sevak');

  const renderUserItem = ({ item }: { item: UserWithRole }) => (
    <TouchableOpacity
      onPress={() => handleUserPress(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        marginBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}
      activeOpacity={0.7}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        position: 'relative',
      }}>
        <Ionicons name="person" size={20} color="#3B82F6" />
        {(item.role === 'master' || item.role === 'admin') && (
          <View style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#F59E0B',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#fff',
          }}>
            <Ionicons 
              name={item.role === 'master' ? 'star' : 'shield'} 
              size={10} 
              color="#fff" 
            />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
          {item.fullName || 'Unknown'}
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>
          {item.mobileNumber}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderCategory = (
    title: string,
    users: UserWithRole[],
    expanded: boolean,
    onToggle: () => void
  ) => {
    if (users.length === 0) return null;

    return (
      <View style={{ marginBottom: 16 }}>
        <TouchableOpacity
          onPress={onToggle}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            backgroundColor: '#F9FAFB',
            borderRadius: 8,
            marginBottom: 8,
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
            {title} ({users.length})
          </Text>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={20}
            color="#6B7280"
          />
        </TouchableOpacity>
        {expanded && (
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.userId}
            scrollEnabled={false}
          />
        )}
      </View>
    );
  };

  if (!isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>
          Dashboard
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280' }}>Manage all users</Text>
      </View>

      {/* Search Bar */}
      <View style={{ padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#F3F4F6',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 15, color: '#111827' }}
            placeholder="Search by name or mobile number..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Users List */}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        data={[]}
        renderItem={() => null}
        keyExtractor={() => 'dummy'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {renderCategory('Master', masterUsers, masterExpanded, () => setMasterExpanded(!masterExpanded))}
            {renderCategory('Admin', adminUsers, adminExpanded, () => setAdminExpanded(!adminExpanded))}
            {renderCategory('Sevak', sevakUsers, sevakExpanded, () => setSevakExpanded(!sevakExpanded))}
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 16 }}>
              {searchQuery ? 'No users found' : 'No users available'}
            </Text>
          </View>
        }
      />
    </View>
  );
}
