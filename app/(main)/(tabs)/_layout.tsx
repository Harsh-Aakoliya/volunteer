import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Header } from '../../../components/Header';
import { useNavigation } from 'expo-router';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { View, StatusBar } from 'react-native';
import AnnouncementScreen from './announcement';
import ChatScreen from './chat';
import React, { createContext, useContext, useState } from 'react';

const Tab = createMaterialTopTabNavigator();

// Create context for header visibility
const HeaderContext = createContext<{
  showHeader: boolean;
  setShowHeader: (show: boolean) => void;
}>({
  showHeader: true,
  setShowHeader: () => {},
});

export const useHeaderContext = () => useContext(HeaderContext);

export default function TabsLayout() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [showHeader, setShowHeader] = useState(true);

  const handleMenuPress = () => {
    navigation.openDrawer();
  };

  return (
    <HeaderContext.Provider value={{ showHeader, setShowHeader }}>
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
        {showHeader && <Header onMenuPress={handleMenuPress} />}
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#6366f1',
            tabBarInactiveTintColor: '#9ca3af',
            tabBarIndicatorStyle: {
              backgroundColor: '#6366f1',
              height: 3,
            },
            tabBarLabelStyle: {
              fontSize: 15,
              fontWeight: '700',
              textTransform: 'none',
              letterSpacing: 0.3,
            },
            tabBarStyle: {
              backgroundColor: '#fff',
              elevation: 4,
              shadowColor: '#6366f1',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              borderBottomWidth: 0,
            },
            swipeEnabled: true,
          }}
        >
          <Tab.Screen 
            name="announcement" 
            component={AnnouncementScreen} 
            options={{ title: 'Announcement' }}
          />
          <Tab.Screen 
            name="chat" 
            component={ChatScreen} 
            options={{ title: 'Chat' }}
          />
        </Tab.Navigator>
      </View>
    </HeaderContext.Provider>
  );
}