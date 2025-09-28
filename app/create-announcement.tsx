//create-announcement.tsx

import { View, Text, SafeAreaView, Alert, BackHandler } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { AuthStorage } from '@/utils/authStorage';
import AnnouncementCreator from '@/components/announcement/AnnouncementCreator';

const Announcement = () => {
  const params = useLocalSearchParams();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Extract params for editing
  const announcementId = params.announcementId;
  const initialTitle = params.title as string;
  const initialBody = (params.body || params.content) as string;
  const announcementMode = params.announcementMode as string;
  const hasCoverImage = params.hasCoverImage as string;
  const departmentTags = params.departmentTags ? JSON.parse(params.departmentTags as string) : [];
  
  console.log("params", params);

  useEffect(() => {
    checkAuthorization();
  }, []);

  const checkAuthorization = async () => {
    try {
      const userData = await AuthStorage.getUser();
      if (!userData || !userData.isAdmin) {
        Alert.alert(
          'Access Denied', 
          'Only HODs and Karyalay users can create announcements.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/announcement')
            }
          ]
        );
        return;
      }
      setIsAuthorized(true);
    } catch (error) {
      console.error('Error checking authorization:', error);
      Alert.alert(
        'Error', 
        'Failed to verify authorization. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/announcement')
          }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-600">Checking authorization...</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthorized) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-red-600">Access Denied</Text>
      </SafeAreaView>
    );
  }

  const handleExit = () => {
    router.replace('/announcement');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <AnnouncementCreator 
        initialTitle={initialTitle || ''} 
        initialContent={initialBody || ''}
        announcementId={announcementId ? Number(announcementId) : undefined}
        announcementMode={announcementMode}
        hasCoverImage={hasCoverImage === 'true' || hasCoverImage === 'TRUE'}
        initialDepartmentTags={departmentTags}
        onExit={handleExit}
      />
    </SafeAreaView>
  );
};

export default Announcement;