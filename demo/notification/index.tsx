// app/index.tsx
import React, { useState, useEffect } from 'react';
import { View, Button, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import axios from 'axios';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');

  // Register for push notifications on component mount
  useEffect(() => {
    registerForPushNotificationsAsync().then((token:any) => {
      setExpoPushToken(token);
    });
  }, []);

  // Function to register for push notifications
  async function registerForPushNotificationsAsync() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert('Failed to get push token');
      return;
    }
    
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  }

  // Handler for button press
  const handleButtonPress = async () => {
    try {
      // Send request to backend
      const response = await axios.post('http://192.168.21.33:3000/trigger-notification', {
        token: expoPushToken
      });
      
      Alert.alert('Success', 'Notification request sent!');
    } catch (error) {
      console.error('Error sending notification request:', error);
      Alert.alert('Error', 'Failed to send notification');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button 
        title="Send Notification" 
        onPress={handleButtonPress} 
      />
    </View>
  );
}
