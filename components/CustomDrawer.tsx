import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { logout } from "@/api/user";
import UserProfile from "@/components/UserProfile";
import ChangePassword from "@/components/ChangePassword";
import { AuthStorage } from "@/utils/authStorage";
import * as Application from 'expo-application';

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

export const CustomDrawer = (props: DrawerContentComponentProps) => {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showChangePasswordSheet, setShowChangePasswordSheet] = useState(false);
  const applicationVersion = Application.nativeApplicationVersion;
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profileData = await AuthStorage.getUser();
      setUserProfile(profileData);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const initials = useMemo(
    () => getInitials(userProfile?.sevakname),
    [userProfile?.sevakname]
  );

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          props.navigation.closeDrawer();
          router.replace("/login");
        },
      },
    ]);
  };

  const closeSheets = () => {
    setShowProfileSheet(false);
    setShowChangePasswordSheet(false);
  };

  const menuItems = [
    {
      icon: "person-outline" as const,
      label: "Check Your Profile",
      onPress: () => setShowProfileSheet(true),
    },
    {
      icon: "lock-closed-outline" as const,
      label: "Change Your Password",
      onPress: () => setShowChangePasswordSheet(true),
    },
  ];

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <ScrollView className="flex-1">
        {/* ── Avatar + Name + Mobile (gradient matches main header) ── */}
        <LinearGradient
          colors={["#FAFAFA", "#F0F0F0", "#E8E8E8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ alignItems: "center", paddingTop: 48, paddingBottom: 24, paddingHorizontal: 20 }}
        >
          {/* Initials circle */}
          <View className="w-20 h-20 rounded-full border-[2.5px] border-blue-500 items-center justify-center bg-blue-50 mb-3">
            <Text className="text-2xl font-bold text-blue-500">
              {initials}
            </Text>
          </View>

          <Text
            className="text-[17px] font-bold text-gray-900 text-center"
            numberOfLines={1}
          >
            {userProfile?.sevakname || "User Name"}
          </Text>

          <Text
            className="text-[13px] text-gray-500 mt-0.5 text-center"
            numberOfLines={1}
          >
            {userProfile?.mobileno || "No mobile number"}
          </Text>
        </LinearGradient>

        {/* Divider */}
        <View className="h-[1px] bg-gray-200 mx-4" />

        {/* ── Menu items ── */}
        <View className="mt-1">
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              activeOpacity={0.6}
              className="flex-row items-center px-5 py-4"
            >
              <View className="w-9 h-9 rounded-full bg-blue-50 items-center justify-center mr-3.5">
                <Ionicons name={item.icon} size={19} color="#3b82f6" />
              </View>
              <Text className="text-[15px] font-medium text-gray-800 flex-1">
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.6}
          className="flex-row items-center px-5 py-4 mt-1"
        >
          <View className="w-9 h-9 rounded-full bg-red-50 items-center justify-center mr-3.5">
            <Ionicons name="log-out-outline" size={19} color="#ef4444" />
          </View>
          <Text className="text-[15px] font-medium text-red-500 flex-1">
            Logout
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Bottom: app version or branding ── */}
      <View className="items-center pb-6 pt-2">
        <Text className="text-[11px] text-gray-300">{
          "v" + applicationVersion}</Text>
      </View>

      {/* ── Profile Bottom Sheet ── */}
      <Modal
        visible={showProfileSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileSheet(false)}
      >
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={closeSheets}>
          <Pressable
            className="bg-white flex-1 pb-4"
            onPress={() => {}}
          >
            {/* Sheet header */}
            <View className="flex-row items-center justify-between px-5 py-4">
              <Text className="text-lg font-bold text-gray-900">Profile</Text>
              <TouchableOpacity
                onPress={() => setShowProfileSheet(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <UserProfile user={userProfile || {}} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Change Password Bottom Sheet ── */}
      <Modal
        visible={showChangePasswordSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangePasswordSheet(false)}
      >
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={closeSheets}>
          <Pressable
            className="bg-white flex-1 pb-4"
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between px-5 py-4">
              <Text className="text-lg font-bold text-gray-900">
                Change Password
              </Text>
              <TouchableOpacity
                onPress={() => setShowChangePasswordSheet(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <ChangePassword />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};