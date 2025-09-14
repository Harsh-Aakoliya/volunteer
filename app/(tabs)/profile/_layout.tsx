// app/chat/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
export default function IndexLayout() {
  return (
    <Stack 
      screenOptions={{
        headerStyle: { backgroundColor: '#f3f4f6' },
        headerTintColor: '#0284c7',
        headerTitleStyle: { fontWeight: 'bold' }
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Profile',
          headerShown:false
        }} 
      />
    </Stack>
  );
}