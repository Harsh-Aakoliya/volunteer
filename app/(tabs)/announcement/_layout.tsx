// app/(tabs)/announcement/_layout.tsx
import { Stack } from 'expo-router';

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
    </Stack>
  );
}