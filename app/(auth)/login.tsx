// import React, { useState } from 'react';
// import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { storage } from '../../utils/storage';
// import { useRouter } from 'expo-router';

// export default function LoginScreen() {
//   const [isLoading, setIsLoading] = useState(false);
//   const router = useRouter();

//   const handleLogin = async () => {
//     setIsLoading(true);
//     try {
//       const randomToken = `token_${Math.random().toString(36).substring(7)}_${Date.now()}`;
//       await storage.saveToken(randomToken);
//       router.replace('/(main)/(tabs)/announcement');
//     } catch (error) {
//       Alert.alert('Login Failed', 'Please try again');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <View style={styles.container}>
//       <View style={styles.content}>
//         <View style={styles.iconContainer}>
//           <Ionicons name="lock-closed" size={80} color="#4A90E2" />
//         </View>

//         <Text style={styles.title}>Welcome Back</Text>
//         <Text style={styles.subtitle}>Login to continue</Text>

//         <TouchableOpacity
//           style={styles.loginButton}
//           onPress={handleLogin}
//           disabled={isLoading}
//         >
//           <Text style={styles.loginButtonText}>
//             {isLoading ? 'Logging in...' : 'Login'}
//           </Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#f5f5f5',
//   },
//   content: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 20,
//   },
//   iconContainer: {
//     marginBottom: 40,
//   },
//   title: {
//     fontSize: 32,
//     fontWeight: 'bold',
//     color: '#333',
//     marginBottom: 10,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: '#666',
//     marginBottom: 40,
//   },
//   loginButton: {
//     backgroundColor: '#4A90E2',
//     paddingVertical: 15,
//     paddingHorizontal: 60,
//     borderRadius: 8,
//     elevation: 3,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 4,
//   },
//   loginButtonText: {
//     color: '#fff',
//     fontSize: 18,
//     fontWeight: '600',
//   },
// });

import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import LoginForm from '@/components/auth/LoginForm';
import * as React from 'react';

export default function Login() {
  return (
    <View className="flex-1 justify-center items-center p-6 bg-white">
      <LoginForm />
    </View>
  );
}