import { Platform, View } from 'react-native';
import LoginForm from '@/components/auth/LoginForm';
import * as React from 'react';
import LoginFormWeb from '@/components/auth/LoginFormWeb';

export default function Login() {
  const isWeb = Platform.OS === ('web' as any);
  return (
    <>
      <View className="flex-1 bg-white">
        {isWeb ? <LoginForm /> : <LoginForm />}
      </View>
    </>
  );
}