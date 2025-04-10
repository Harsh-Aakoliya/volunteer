import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import RichTextEditor from '@/components/texteditor/texteditor';
import { SafeAreaView } from 'react-native-web';

const Announcement = () => {
  const navigation = useNavigation();

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

      {/* Rich Text Editor */}
      <RichTextEditor />
    </View>
  );
};

export default Announcement;
