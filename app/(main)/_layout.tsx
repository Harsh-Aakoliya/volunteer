
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { CustomDrawer } from '../../components/CustomDrawer';
import React from 'react';
export default function MainLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={{
          headerShown: false,
          drawerPosition: 'left',
          drawerType: 'slide',
          swipeEdgeWidth: 100, // Enable swipe from 100px from left edge
        }}
      >
        <Drawer.Screen name="(tabs)" />
        <Drawer.Screen name="announcement-detail" />
        <Drawer.Screen name="chat-detail" />
      </Drawer>
    </GestureHandlerRootView>
  );
}