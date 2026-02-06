import * as React from "react";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { fetchUserProfile, logout } from "@/api/user";
import UserProfile from "@/components/UserProfile";
import ChangePassword from "@/components/ChangePassword";
import { AuthStorage } from "@/utils/authStorage";

export const CustomDrawer = (props: DrawerContentComponentProps) => {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showChangePasswordSheet, setShowChangePasswordSheet] = useState(false);
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profileData = await AuthStorage.getUser();
      setUserProfile(profileData);
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
    }
  };

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

  const handleProfilePress = () => {
    setShowProfileSheet(true);
  };

  const handleChangePasswordPress = () => {
    setShowChangePasswordSheet(true);
  };

  const closeSheets = () => {
    setShowProfileSheet(false);
    setShowChangePasswordSheet(false);
  };

  const renderSheetHeader = (title: string, onClose: () => void) => (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={22} color="#111827" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.userSection}>
          <View style={styles.userInfo}>
            <View style={styles.userDetails}>
              <Text style={styles.fullName} numberOfLines={1}>
                {userProfile?.sevakname || "User Name"}
              </Text>
              <Text style={styles.mobileNumber} numberOfLines={1}>
                {userProfile?.mobileno || "No mobile number"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={handleProfilePress}>
          <Ionicons name="person" size={20} color="#3b82f6" />
          <Text style={styles.menuText}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleChangePasswordPress}>
          <Ionicons name="key" size={20} color="#3b82f6" />
          <Text style={styles.menuText}>Change Password</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#3b82f6" />
          <Text style={styles.menuText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Profile Bottom Sheet */}
      <Modal
        visible={showProfileSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileSheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSheets}>
          <Pressable style={styles.modalContainer} onPress={() => {}}>
            {renderSheetHeader("Profile", () => setShowProfileSheet(false))}
            <View style={{ flex: 1 }}>
              <UserProfile user={userProfile || {}} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Change Password Bottom Sheet */}
      <Modal
        visible={showChangePasswordSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangePasswordSheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSheets}>
          <Pressable style={styles.modalContainer} onPress={() => {}}>
            {renderSheetHeader("Change Password", () => setShowChangePasswordSheet(false))}
            <View style={{ flex: 1 }}>
              <ChangePassword />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 30,
    paddingLeft: 20,
    backgroundColor: "#3b82f6",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userDetails: {
    flex: 1,
  },
  fullName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  mobileNumber: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    paddingBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
});