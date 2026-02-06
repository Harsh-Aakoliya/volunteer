import { Platform, View } from 'react-native';
import LoginForm from '@/components/auth/LoginForm';
import * as React from 'react';

export default function Login() {
  return (
    <>
      <View className="flex-1 bg-white">
        <LoginForm />
      </View>
    </>
  );
}