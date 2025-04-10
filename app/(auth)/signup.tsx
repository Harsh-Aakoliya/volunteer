import { View, Text } from 'react-native';
import { Link } from 'expo-router';
// import SignupForm from '../../components/auth/SignupForm';
import SignupForm from '@/components/auth/SignupForm';

export default function Signup() {
  return (
    <View className="flex-1 justify-center items-center p-6 bg-white">
      <Text className="text-2xl font-bold mb-6">Sign Up</Text>
      <SignupForm />
    </View>
  );
}