// app/(tabs)/announcement/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
export default function AnnouncementLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Announcements',
          headerShown:true
        }} 
      />
      <Stack.Screen 
        name="preview" 
        options={{ 
          headerShown: false
        }} 
      />
    </Stack>
  );
}