import { View, Text, Button } from 'react-native'
import React from 'react'
import { logout } from '@/api/auth';
import { router } from 'expo-router';

const LoginSuccess = () => {
  return (
    <View>
      <Text>LoginSuccess</Text>
      <Button title="Logout" onPress={() => {
        logout();
        router.replace('/login');
      }} />
    </View>
  )
}

export default LoginSuccess;