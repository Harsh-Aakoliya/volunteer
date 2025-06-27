import React, { useState } from "react";
import {
  View,
  Text,
  Alert,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomButton from "../ui/CustomButton";
import CustomInput from "../ui/CustomInput";
import { login } from "@/api/auth";
import { ScrollView } from "react-native";


export default function LoginForm() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ mobile: false, password: false });

  //chekcing for changes
  const handleLogin = async () => {
    setTouched({ mobile: true, password: true });

    if (!mobileNumber || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      setIsLoading(true);
      const response = await login(mobileNumber, password);
      console.log("response got after login at frontend", response);
      // The login function already handles success/failure and redirects
      // No need to handle success here as auth.ts handles it
      if (response && response.message) {
        Alert.alert("Error", response.message);
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView className="w-full flex-1 bg-white">
      <View className="flex-1">
        <View className="relative w-full h-[280px]">
          {/* <Image 
          source={require('../../assets/images/icon.png')}
          className="w-full h-[280px]"
          resizeMode="cover"
          style={{height:100,width:100}}
        /> */}
          <View className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white">
            <Text className="text-3xl text-gray-800 font-JakartaBold">
              Welcome Back
            </Text>
            <Text className="text-gray-600 font-JakartaMedium mt-2">
              Log in to continue
            </Text>
          </View>
        </View>

        <View className="p-6 space-y-5">
          <CustomInput
            label="Mobile Number"
            placeholder="Enter mobile number"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            leftIcon={
              <Ionicons name="call-outline" size={20} color="#6B7280" />
            }
            error={!mobileNumber ? "Mobile number is required" : ""}
            touched={touched.mobile}
            onBlur={() => setTouched((prev) => ({ ...prev, mobile: true }))}
          />

          <CustomInput
            label="Password"
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            leftIcon={
              <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
            }
            rightIcon={
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#6B7280"
                />
              </Pressable>
            }
            error={!password ? "Password is required" : ""}
            touched={touched.password}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          />

          <View className="pt-4">
            <CustomButton
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              IconRight={() => (
                <Ionicons name="arrow-forward" size={20} color="white" />
              )}
            />

            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-gray-600 font-JakartaMedium">
                Don't have an account?{" "}
              </Text>
              <Text
                className="text-[#0286ff] font-JakartaSemiBold"
                onPress={() => router.push("/signup")}
              >
                Sign Up
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
