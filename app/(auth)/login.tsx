import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import LoginForm from '@/components/auth/LoginForm';
import React from 'react';

export default function Login() {
  return (
    <View className="flex-1 justify-center items-center p-6 bg-white">
      <Text className="text-2xl font-bold mb-6">Login</Text>
      <LoginForm />
      <Link href="/signup" className="mt-4 text-blue-500">
        New user? Sign Up
      </Link>
    </View>
  );
}