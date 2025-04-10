import { View, Text, FlatList, Pressable } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import CustomButton from "../../components/ui/CustomButton";
import { useAuth } from "../../hooks/useAuth";
import { getPendingUsers, approveUser } from "@/api/admin";

export default function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const { logout } = useAuth();

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
    <View className="flex-1 p-6 bg-white">
      <Text className="text-2xl font-bold mb-6">Admin Dashboard</Text>
      <FlatList
        data={pendingUsers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View className="flex-row items-center bg-gray-100 p-4 rounded-lg mb-2">
            <Pressable
              onPress={() => toggleSelection(item.mobile_number)}
              className="mr-3 w-6 h-6 border border-gray-500 rounded flex items-center justify-center"
            >
              <Text>{selectedUsers.has(item.mobile_number) ? "✅" : "⬜"}</Text>
            </Pressable>
            <View>
              <Text>
                Mobile:{" "}
                <Text className="font-semibold">{item.mobile_number}</Text>
              </Text>
              <Text>
                ID: <Text className="font-semibold">{item.specific_id}</Text>
              </Text>
            </View>
          </View>
        )}
      />

      <CustomButton
        title="Approve Selected"
        onPress={handleApproveAll}
        variant="primary"
        className="mt-4"
        disabled={selectedUsers.size === 0}
      />
      <CustomButton
        title="Logout"
        onPress={handleLogout}
        variant="danger"
        className="mt-4"
      />
    </View>
  );
}
