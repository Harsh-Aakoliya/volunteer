import React, { useState } from "react";
import { View, Text, Alert, Image, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomInput from "../ui/CustomInput";
import CustomButton from "../ui/CustomButton";
import { register } from "@/api/auth";

export default function SignupForm() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [userId, setuserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({ mobile: false, id: false });

  const handleSignup = async () => {
    setTouched({ mobile: true, id: true });

    if (!mobileNumber || !userId) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      setIsLoading(true);
      const data = await register(mobileNumber, userId);
      if (data.success) {
        Alert.alert(
          "Success",
          "Registration request sent. Please wait for admin approval.",
          [{ text: "OK", onPress: () => router.replace("/") }]
        );
      } else {
        Alert.alert("Failure", data.message, [
          { text: "OK", onPress: () => router.replace("/") },
        ]);
      }
    } catch (error) {
      Alert.alert("Error", "Registration failed");
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
              Create Account
            </Text>
            <Text className="text-gray-600 font-JakartaMedium mt-2">
              Join our community today
            </Text>
          </View>
        </View>

        <View className="p-6 space-y-5">
          <CustomInput
            label="Mobile Number"
            placeholder="Enter your mobile number"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            leftIcon={
              <Ionicons name="call-outline" size={20} color="#6B7280" />
            }
            error={
              !mobileNumber && touched.mobile ? "Mobile number is required" : ""
            }
            touched={touched.mobile}
            onBlur={() => setTouched((prev) => ({ ...prev, mobile: true }))}
          />

          <CustomInput
            label="Specific ID"
            placeholder="Enter your specific ID"
            value={userId}
            onChangeText={setuserId}
            leftIcon={
              <Ionicons name="card-outline" size={20} color="#6B7280" />
            }
            error={!userId && touched.id ? "Specific ID is required" : ""}
            touched={touched.id}
            onBlur={() => setTouched((prev) => ({ ...prev, id: true }))}
          />

          <View className="pt-8">
            <CustomButton
              title="Create Account"
              onPress={handleSignup}
              loading={isLoading}
              IconRight={() => (
                <Ionicons name="arrow-forward" size={20} color="white" />
              )}
            />

            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-gray-600 font-JakartaMedium">
                Already have an account?{" "}
              </Text>
              <Text
                className="text-[#0286ff] font-JakartaSemiBold"
                onPress={() => router.replace("/login")}
              >
                Sign In
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
