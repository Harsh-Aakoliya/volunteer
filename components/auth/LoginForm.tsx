import React, { useState } from "react";
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ScrollView,
  TextInput,
  Modal,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomButton from "../ui/CustomButton";
import CustomInput from "../ui/CustomInput";
import { login } from "@/api/auth";
import { updateDevIP } from "@/constants/api";
import { getDefaultDevIP } from "@/app/index";

export default function LoginForm() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ mobile: false, password: false });
  const [devIP, setDevIP] = useState(getDefaultDevIP());
  const [showIPModal, setShowIPModal] = useState(false);

  const handleLongPressSignIn = () => {
    Keyboard.dismiss();
    Alert.alert(
      "🔧 Developer Mode",
      "Would you like to configure the backend IP address?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Configure", onPress: () => setShowIPModal(true) },
      ]
    );
  };

  const handleLogin = async () => {
    // First dismiss keyboard
    Keyboard.dismiss();

    // Set touched state for validation
    setTouched({ mobile: true, password: true });

    if (!mobileNumber || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      setIsLoading(true);
      const response = await login(mobileNumber, password);
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

  // Handle background press to dismiss keyboard
  const handleBackgroundPress = () => {
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Outer Pressable - Dismisses keyboard when tapping outside form */}
        <Pressable
          onPress={handleBackgroundPress}
          className="flex-1 bg-white justify-start"
        >
          {/* 10% Left Spacing */}
          <View className="flex-row flex-1">
            <View className="w-[10%]" />

            {/* 80% Center Container - Login Form */}
            <View className="w-[80%] pt-8">
              {/* Header Section */}
              <View className="items-center mb-8">
                <View className="w-20 h-20 rounded-2xl bg-blue-500 items-center justify-center mb-5">
                  <Ionicons name="shield-checkmark" size={40} color="white" />
                </View>
                <Text className="text-2xl font-JakartaBold text-gray-800 mb-2">
                  Welcome Back
                </Text>
              </View>

              {/* Form Section */}
              <View>
                {/* Mobile Input */}
                <View className="mb-5">
                  <CustomInput
                    label="Mobile Number"
                    placeholder="Enter mobile number"
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    keyboardType="phone-pad"
                    leftIcon={
                      <Ionicons
                        name="call-outline"
                        size={20}
                        color="#6B7280"
                      />
                    }
                    error={
                      !mobileNumber && touched.mobile
                        ? "Mobile number is required"
                        : ""
                    }
                    touched={touched.mobile}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, mobile: true }))
                    }
                  />
                </View>

                {/* Password Input */}
                <View className="mb-6">
                  <CustomInput
                    label="Password"
                    placeholder="Enter password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    leftIcon={
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#6B7280"
                      />
                    }
                    rightIcon={
                      <Pressable
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={showPassword ? "eye-outline" : "eye-off-outline"}
                          size={20}
                          color="#6B7280"
                        />
                      </Pressable>
                    }
                    error={
                      !password && touched.password
                        ? "Password is required"
                        : ""
                    }
                    touched={touched.password}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, password: true }))
                    }
                  />
                </View>

                {/* Sign In Button */}
                <Pressable
                  onPress={handleLogin}
                  onLongPress={handleLongPressSignIn}
                  delayLongPress={3000}
                  disabled={isLoading}
                >
                  {({ pressed }) => (
                    <View
                      pointerEvents="none"
                      style={{ opacity: pressed ? 0.8 : 1 }}
                    >
                      <CustomButton
                        title="Sign In"
                        onPress={() => {}}
                        loading={isLoading}
                        IconRight={() => (
                          <Ionicons
                            name="arrow-forward"
                            size={20}
                            color="white"
                          />
                        )}
                      />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {/* 10% Right Spacing */}
            <View className="w-[10%]" />
          </View>
        </Pressable>
      </ScrollView>

      {/* IP Modal - Modal Overlay */}
      <Modal
        visible={showIPModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowIPModal(false);
        }}
      >
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setShowIPModal(false);
          }}
          className="flex-1 bg-black/50 items-center justify-center"
        >
          <Pressable
            onPress={() => {}}
            className="bg-white p-5 rounded-2xl w-[80%]"
          >
            <Text className="text-lg font-JakartaBold mb-4">
              Set Backend IP Address
            </Text>
            <TextInput
              placeholder="e.g., 192.168.1.100:3000"
              value={devIP.replace(/^https?:\/\//, "")}
              onChangeText={(text) => setDevIP(text)}
              keyboardType="url"
              className="border border-gray-300 rounded-lg px-4 py-3 mb-5"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <CustomButton
                  title="Cancel"
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowIPModal(false);
                  }}
                  bgVariant="secondary"
                />
              </View>
              <View className="flex-1">
                <CustomButton
                  title="Save"
                  onPress={() => {
                    Keyboard.dismiss();
                    if (!devIP.trim()) {
                      Alert.alert("Error", "IP address cannot be empty.");
                      return;
                    }
                    let formattedUrl = devIP.trim();
                    if (
                      !formattedUrl.startsWith("http://") &&
                      !formattedUrl.startsWith("https://")
                    ) {
                      formattedUrl = "http://" + formattedUrl;
                    }
                    updateDevIP(formattedUrl);
                    setDevIP(formattedUrl);
                    Alert.alert(
                      "Success",
                      `Backend IP updated to:\n${formattedUrl}`
                    );
                    setShowIPModal(false);
                  }}
                  bgVariant="success"
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}