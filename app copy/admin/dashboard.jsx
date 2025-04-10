import { View, Text, FlatList, ScrollView, RefreshControl } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import CustomButton from "../../components/ui/CustomButton";
import { useAuth } from "../../hooks/useAuth";
import { getPendingUsers, approveUser } from "@/api/admin";
import Checkbox from "expo-checkbox";
import { Ionicons } from '@expo/vector-icons';

export default function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const { logout } = useAuth();

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingUsers();
    setRefreshing(false);
  };
  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const users = await getPendingUsers();
      console.log("Fetched Pending Users:", users);
      setPendingUsers(users); // Store as received, using correct keys
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleApproveAll = async () => {
    try {
      const usersToApprove = Array.from(selectedUsers); // Convert Set to Array
      console.log("Approving Users:", usersToApprove);

      await Promise.all(
        usersToApprove.map((mobile_number) => approveUser(mobile_number))
      );

      setSelectedUsers(new Set()); // Clear selection after approval
      fetchPendingUsers(); // Refresh pending users list
    } catch (error) {
      console.error("Error approving users:", error);
    }
  };

  const toggleSelection = (mobile_number) => {
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
    await logout();
    router.replace("/");
  };

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
            variant="danger"
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
              variant="primary"
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