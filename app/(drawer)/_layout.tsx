// app/(drawer)/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { CustomDrawer } from '@/components/CustomDrawer';
import React from 'react';

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={{
          headerShown: false,
          drawerPosition: 'left',
          drawerType: 'slide',
          swipeEnabled: true,
          swipeEdgeWidth: 500,
        }}
      >
        <Drawer.Screen 
          name="index" 
          options={{
            drawerLabel: 'Chat Rooms',
            title: 'Chat Rooms'
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

