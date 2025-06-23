import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import RichTextEditor from '@/components/texteditor/texteditor';
import { useLocalSearchParams } from 'expo-router';

const Announcement = () => {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  
  // Extract params for editing
  const announcementId = Number(params.announcementId);
  const initialTitle = params.title as string;
  const initialContent = params.content as string;
  const announcementMode = params.announcementMode as string;
  console.log("announcementMode", announcementMode);
  console.log("initialTitle", initialTitle);
  console.log("initialContent", initialContent);
  console.log("announcementId", announcementId);
  
  // Determine if we're editing or creating
  const isEditing = !!announcementId;

  return (
    <View style={{ flex: 1 }}>
      {/* Rich Text Editor with initial values if editing */}
      <RichTextEditor 
        initialTitle={initialTitle} 
        initialContent={initialContent}
        announcementId={announcementId}
        announcementMode={announcementMode}
      />
    </View>
  );
};

export default Announcement;