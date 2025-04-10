// app/(tabs)/chat/_layout.tsx
import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Chats',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={{ 
          title: 'Chat',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="new" 
        options={{ 
          title: 'New Chat',
          headerShown: true 
        }} 
      />
    </Stack>
  );
}