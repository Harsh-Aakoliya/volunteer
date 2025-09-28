import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Alert,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomButton from "../ui/CustomButton";
import CustomInput from "../ui/CustomInput";
import { login } from "@/api/auth";
import { ScrollView } from "react-native";
import * as Application from 'expo-application';
import { API_URL, setApiUrl, updateDevIP } from "@/constants/api";
import axios from "axios";
import { Updater } from "../Updater";
import AppInfo from "./AppInfo";
import { getDevModeStatus, getDefaultDevIP } from "@/app/index";

export default function LoginForm() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ mobile: false, password: false, devIP: false });
  const [devIP, setDevIP] = useState(getDefaultDevIP()); // Initialize with default dev IP
  const [showAppInfo, setShowAppInfo] = useState(false);
  const [clickCount, setClickCount] = useState(0); // New state for click tracking
  
  // // Check if dev mode is enabled
  // const isDevMode = getDevModeStatus();

  // const handleSetDevIP = () => {
  //   if (devIP.trim()) {
  //     // Ensure URL has proper format
  //     let formattedUrl = devIP.trim();
  //     if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
  //       formattedUrl = 'http://' + formattedUrl;
  //     }
      
  //     updateDevIP(formattedUrl);
  //     setDevIP(formattedUrl);
  //     Alert.alert("Success", "Development IP updated successfully!");
  //   } else {
  //     Alert.alert("Error", "Please enter a valid IP address");
  //   }
  // };
  const [showIPModal, setShowIPModal] = useState(false);

  const handleLoginToContinuePress = () => {
    setClickCount((prevCount) => {
      const newCount = prevCount + 1;
      console.log("newCount", newCount);
  
      if (newCount >= 7) {
        Alert.alert(
          "🔧 Developer Mode Activated",
          "You can now set a custom backend IP address. Press OK to proceed.",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "OK",
              onPress: () => {
                setShowIPModal(true); // Show our own input box
              },
            },
          ]
        );
        return 0; // Reset click count after triggering
      }
  
      return newCount;
    });
  };

  const handleLogin = async () => {
    setTouched({ mobile: true, password: true, devIP: true });

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

  // Handler for the info icon clicks
  // const handleInfoIconPress = () => {
  //   setClickCount(prevCount => {
  //     const newCount = prevCount + 1;
  //     if (newCount >= 7) {
  //       setForceShowDevIP(true);  // Force show the IP box
  //       return 0;  // Reset the count for potential future use
  //     }
  //     return newCount;
  //   });
  // };

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
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-3xl text-gray-800 font-JakartaBold">
                  Welcome Back again
                </Text>
                <TouchableOpacity onPress={handleLoginToContinuePress}>
                  <Text className="text-gray-600 font-JakartaMedium mt-2">
                    Log in to continue
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Repurposed TouchableOpacity for click detection */}
              {/* <TouchableOpacity 
                onPress={handleInfoIconPress}  // Updated handler
                className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center"
              >
                <Ionicons name="information-outline" size={20} color="#6b7280" />
              </TouchableOpacity> */}

              {/* Custom IP Input Modal */}
{showIPModal && (
  <View className="absolute inset-0 bg-black/50 flex justify-center items-center z-50">
    <View className="bg-white p-6 rounded-xl w-11/12 max-w-md mx-4">
      <Text className="text-lg font-JakartaBold mb-4">Set Backend IP Address</Text>
      <CustomInput
        placeholder="e.g., 192.168.1.100:3000"
        value={devIP.replace(/^https?:\/\//, '')}
        onChangeText={(text) => setDevIP(text)}
        keyboardType="url"
      />
      <View className="flex-row justify-between mt-4 space-x-2">
        <CustomButton
          title="Cancel"
          onPress={() => setShowIPModal(false)}
          bgVariant="secondary"
          className="flex-1"
        />
        <CustomButton
          title="Save"
          onPress={() => {
            if (!devIP.trim()) {
              Alert.alert("Error", "IP address cannot be empty.");
              return;
            }

            let formattedUrl = devIP.trim();
            if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
              formattedUrl = 'http://' + formattedUrl;
            }

            updateDevIP(formattedUrl);
            setDevIP(formattedUrl);
            Alert.alert("Success", `Backend IP updated to:\n${formattedUrl}`);
            setShowIPModal(false);
            setClickCount(0); // Fully reset counter
          }}
          bgVariant="success"
          className="flex-1"
        />
      </View>
    </View>
  </View>
)}
            </View>
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
                  color="#6B7280" />
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

      {/* App Info Modal - Commented out as it's not used in this context */}
      {/* <AppInfo 
        visible={showAppInfo} 
        onClose={() => setShowAppInfo(false)} 
      /> */}
    </ScrollView>
  );
}