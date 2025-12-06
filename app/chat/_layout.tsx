// app/chat/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
export default function ChatLayout() {
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
          title: 'Chat Rooms' 
        }} 
      />
      <Stack.Screen 
        name="room-info" 
        options={{ 
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="create-room" 
        options={{ 
          title: 'Select Users' 
        }} 
      />
      <Stack.Screen 
        name="add-members" 
        options={{ 
          title: 'Add Members' 
        }} 
      />
      <Stack.Screen 
        name="create-chat-announcement" 
        options={{ 
          title: 'Create Announcement',
          headerShown: false
        }} 
      />
    </Stack>
  );
}