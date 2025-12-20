import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchUserProfile, logout } from '@/api/user';
import { AuthStorage } from '@/utils/authStorage';
import { login } from '@/api/auth';

export const CustomDrawer = (props: DrawerContentComponentProps) => {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const profileData = await fetchUserProfile();
      setUserProfile(profileData);
      console.log("userProfile in profile screen of drawer from backend", profileData);
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            props.navigation.closeDrawer();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleProfilePress = async () => {
    props.navigation.closeDrawer();
    // Get current logged-in user data
    const currentUser = await AuthStorage.getUser();
    if (currentUser) {
      router.push({
        pathname: '/(drawerOptions)/user-profile',
        params: {
          userData: JSON.stringify(currentUser)
        }
      });
    }
  };

  const handleDashboardPress = () => {
    props.navigation.closeDrawer();
    router.push("/(admin)/dashboard");
  };

  const handleDepartmentsPress = () => {
    props.navigation.closeDrawer();
    router.push("/(departments)" as any);
  };

  // const isMaster = userProfile?.role === 'master' || userProfile?.isMaster;
  // const isAdmin = userProfile?.role === 'admin' || userProfile?.isAdmin;
  // const roleText = isMaster ? 'Master' : isAdmin ? 'Admin' : 'Sevak';

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }}>
        {/* User Profile Section */}
        <TouchableOpacity 
          style={styles.userSection}
          onPress={handleProfilePress}
        >
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={24} color="#3b82f6" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.fullName} numberOfLines={1}>
                {userProfile?.sevakname || 'User Name'}
              </Text>
              <Text style={styles.mobileNumber} numberOfLines={1}>
                {userProfile?.mobileno || 'No mobile number'}
              </Text>
            </View>
          </View>
          {/* <Ionicons name="chevron-forward" size={24} color="#666" /> */}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* logout option */}
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#3b82f6" />
          <Text style={styles.menuText}>Logout</Text>
        </TouchableOpacity>


        {/* { Profil page option} */}
        <TouchableOpacity style={styles.menuItem} onPress={handleProfilePress}>
          <Ionicons name="person" size={20} color="#3b82f6" />
          <Text style={styles.menuText}>Profile</Text>
        </TouchableOpacity>
        <View style={styles.divider} />

        {/* Role Section */}
        {/* <View style={styles.roleSection}>
          <Text style={styles.roleText}>{roleText}</Text>
        </View> */}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Dashboard Option - Only for Master/Admin */}
        {/* {(isMaster || isAdmin) && (
          <>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleDashboardPress}
            >
              <Ionicons name="stats-chart" size={20} color="#3b82f6" />
              <Text style={styles.menuText}>Dashboard</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
          </>
        )} */}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 30,
    backgroundColor: '#3b82f6',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  fullName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  mobileNumber: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  roleSection: {
    padding: 16,
  },
  roleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#333',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  logoutButton: {
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  logoutText: {
    color: '#8B0000',
    fontSize: 14,
    fontWeight: '500',
  },
});