// app/admin/dashboard.tsx
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import CustomButton from "@/components/ui/CustomButton";
import { AuthStorage } from "@/utils/authStorage";
import { getPendingUsers, approveUser } from "@/api/admin";
import Checkbox from "expo-checkbox";
import { Ionicons } from '@expo/vector-icons';

// Define a type for pending users
interface PendingUser {
  id: number;
  mobile_number: string;
  specific_id: string;
}

export default function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      const adminStatus = await AuthStorage.getAdminStatus();
      setIsAdmin(adminStatus);

      // Redirect if not admin
      if (!adminStatus) {
        router.replace("/");
      }
    };

    checkAdminStatus();
  }, []);

  // Fetch pending users
  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const users = await getPendingUsers();
      console.log("Fetched Pending Users:", users);
      setPendingUsers(users);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingUsers();
    setRefreshing(false);
  };

  const handleApproveAll = async () => {
    try {
      const usersToApprove = Array.from(selectedUsers);
      console.log("Approving Users:", usersToApprove);

      await Promise.all(
        usersToApprove.map((mobile_number) => approveUser(mobile_number))
      );

      setSelectedUsers(new Set());
      fetchPendingUsers();
    } catch (error) {
      console.error("Error approving users:", error);
    }
  };

  const toggleSelection = (mobile_number: string) => {
    setSelectedUsers((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(mobile_number)) {
        newSelected.delete(mobile_number);
      } else {
        newSelected.add(mobile_number);
      }
      return newSelected;
    });
  };

  const handleLogout = async () => {
    console.log("Logout pressed");
    await AuthStorage.clear();
    router.replace("/");
  };

  // If not admin, don't render anything
  if (!isAdmin) {
    return null;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-bold text-gray-800">Admin Dashboard</Text>
            <Text className="text-gray-500">Manage pending approvals</Text>
          </View>
          <CustomButton
            title="Logout"
            onPress={handleLogout}
            bgVariant="danger"
            textVariant="primary"
          />
        </View>
      </View>

      {/* Stats Section */}
      <View className="flex-row p-4 justify-between">
        <View className="bg-white p-4 rounded-xl shadow-sm flex-1 mr-2">
          <View className="flex-row items-center">
            <View className="bg-blue-100 p-2 rounded-full mr-2">
              <Ionicons name="people-outline" size={24} color="#3B82F6" />
            </View>
            <Text className="text-gray-600">Pending Users</Text>
          </View>
          <Text className="text-2xl font-bold mt-2">{pendingUsers.length}</Text>
        </View>
        <View className="bg-white p-4 rounded-xl shadow-sm flex-1 ml-2">
          <View className="flex-row items-center">
            <View className="bg-green-100 p-2 rounded-full mr-2">
              <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
            </View>
            <Text className="text-gray-600">Selected</Text>
          </View>
          <Text className="text-2xl font-bold mt-2">{selectedUsers.size}</Text>
        </View>
      </View>

      {/* Main Content */}
      <FlatList
        className="px-4"
        data={pendingUsers}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View className="flex-row justify-between items-center py-4">
            <Text className="text-lg font-semibold text-gray-700">Pending Approvals</Text>
            <CustomButton
              title="Approve Selected"
              onPress={handleApproveAll}
              bgVariant="primary"
              textVariant="primary"
              disabled={selectedUsers.size === 0}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100">
            <View className="flex-row items-center">
              <Checkbox
                value={selectedUsers.has(item.mobile_number)}
                onValueChange={() => toggleSelection(item.mobile_number)}
                className="mr-4"
              />
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="call-outline" size={16} color="#6B7280" />
                  <Text className="text-gray-800 font-semibold ml-2">
                    {item.mobile_number}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="card-outline" size={16} color="#6B7280" />
                  <Text className="text-gray-600 ml-2">
                    ID: {item.specific_id}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}