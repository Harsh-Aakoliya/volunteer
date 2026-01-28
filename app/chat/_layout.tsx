// app/chat/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#f3f4f6' },
        headerTintColor: '#0284c7',
        headerTitleStyle: { fontWeight: 'bold' },

        // 👉 animation config
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        animationDuration: 50,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="room-info"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="create-room"
        options={{ title: 'Select Users' }}
      />

      <Stack.Screen
        name="add-members"
        options={{ title: 'Add Members' }}
      />

      <Stack.Screen
        name="Announcement"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="[roomId]"
        options={{
          headerShown: false,
          statusBarStyle: 'dark',
          statusBarBackgroundColor: 'white',
        }}
      />

      <Stack.Screen
        name="[roomId]/attachments"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="Polling"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="poll-votes"
        options={{ headerShown: false }}
      />

      {/* <Stack.Screen
        name="video-call"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'none',
        }}
      /> */}
    </Stack>
  );
}
