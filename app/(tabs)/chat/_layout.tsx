// app/chat/_layout.tsx
import { Stack } from 'expo-router';

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
        name="create-room" 
        options={{ 
          title: 'Select Users' 
        }} 
      />
      <Stack.Screen 
        name="create-room-metadata" 
        options={{ 
          title: 'Room Details' 
        }} 
      />
    </Stack>
  );
}