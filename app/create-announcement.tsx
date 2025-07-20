import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import RichTextEditor from '@/components/texteditor/texteditor';
import { useLocalSearchParams } from 'expo-router';

const Announcement = () => {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  
  // Extract params for editing
  const announcementId = params.announcementId;
  const initialTitle = params.title as string;
  const initialBody = (params.body || params.content) as string;
  const announcementMode = params.announcementMode as string;
  const hasCoverImage = params.hasCoverImage as string;
  // Determine if we're editing or creating
  const isEditing = !!announcementId;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <RichTextEditor 
        initialTitle={initialTitle || ''} 
        initialContent={initialBody || ''}
        announcementId={announcementId ? Number(announcementId) : undefined}
        announcementMode={announcementMode}
        coverImage={hasCoverImage}
      />
    </SafeAreaView>
  );
};

export default Announcement;