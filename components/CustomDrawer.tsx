import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchUserProfile, logout } from '@/api/user';

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

  const handleProfilePress = () => {
    props.navigation.closeDrawer();
    router.push('/profile');
  };

  const handleDashboardPress = () => {
    props.navigation.closeDrawer();
    router.push("/(admin)/dashboard");
  };

  const handleDepartmentsPress = () => {
    props.navigation.closeDrawer();
    router.push("/(departments)" as any);
  };

  const isKaryalay = userProfile?.departments?.includes('Karyalay') || false;
  const isHOD = userProfile?.isAdmin && !isKaryalay;

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
              <Text style={styles.avatarText}>
                {userProfile?.fullName?.charAt(0) || userProfile?.full_name?.charAt(0) || 'U'}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.fullName} numberOfLines={1}>
                {userProfile?.fullName || userProfile?.full_name || 'User Name'}
              </Text>
              <Text style={styles.mobileNumber} numberOfLines={1}>
                {userProfile?.mobileNumber || 'No mobile number'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Role and Departments Section */}
        <View style={styles.roleSection}>
          <Text style={styles.roleText}>
            {userProfile?.isAdmin ? "HOD" : "Sevak"}
          </Text>
          {userProfile?.departments && userProfile.departments.length > 0 && (
            <View style={styles.departmentsContainer}>
              {userProfile.departments.map((dept: string, index: number) => (
                <View key={index} style={styles.departmentChip}>
                  <Text style={styles.departmentText}>{dept}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Menu Items */}
        {(isKaryalay || isHOD) && (
          <View style={styles.menuSection}>
            {isKaryalay && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDashboardPress}>
                <Ionicons name="stats-chart" size={24} color="#6366f1" />
                <Text style={styles.menuText}>Dashboard</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={handleDepartmentsPress}>
              <Ionicons name="business" size={24} color="#6366f1" />
              <Text style={styles.menuText}>Departments</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Logout Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#6366f1',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
    marginBottom: 12,
  },
  departmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  departmentChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  departmentText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  menuSection: {
    paddingTop: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    padding: 15,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});