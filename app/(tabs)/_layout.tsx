// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#0284c7',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            height: 60,
            paddingBottom: 5,
          },
          headerShown:false
        }}
      >
        <Tabs.Screen
          name="announcement"
          options={{
            title: 'Announcements',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="megaphone-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chats',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
  );
}