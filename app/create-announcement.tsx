import { View, Text, TouchableOpacity } from 'react-native';
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
  const initialBody = params.body as string;
  
  // Determine if we're editing or creating
  const isEditing = !!announcementId;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Back Button */}
      <TouchableOpacity 
        onPress={() => navigation.goBack()} 
        style={{
          padding: 10, 
          backgroundColor: '#ddd', 
          borderRadius: 5, 
          marginBottom: 10, 
          alignSelf: 'flex-start'
        }}
      >
        <Text style={{ fontSize: 16 }}>← Back</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        {isEditing ? 'Edit Announcement' : 'Create Announcement'}
      </Text>

      {/* Rich Text Editor with initial values if editing */}
      <RichTextEditor 
        initialTitle={initialTitle || ''} 
        initialContent={initialBody || ''}
        announcementId={announcementId ? Number(announcementId) : undefined}
      />
    </View>
  );
};

export default Announcement;