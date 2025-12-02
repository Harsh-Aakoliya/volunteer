import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Alert,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomInput from "../ui/CustomInput";
import CustomButton from "../ui/CustomButton";
import { register } from "@/api/auth";

const { width, height } = Dimensions.get("window");

export default function SignupForm() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({
    mobile: false,
    id: false,
    fullName: false,
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignup = async () => {
    Keyboard.dismiss();
    setTouched({ mobile: true, id: true, fullName: true });

    if (!mobileNumber || !userId || !fullName) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!acceptedTerms) {
      Alert.alert("Error", "Please accept the terms and conditions");
      return;
    }

    try {
      setIsLoading(true);
      const data = await register(mobileNumber, userId, fullName);
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

  const InputIcon = ({ name, color = "#3B82F6" }: { name: string; color?: string }) => (
    <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center">
      <Ionicons name={name as any} size={20} color={color} />
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Section */}
            <View
              className="items-center justify-center pt-10 pb-6"
              style={{ minHeight: height * 0.25 }}
            >
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
                className="items-center"
              >
                {/* Logo */}
                <View className="w-20 h-20 rounded-3xl bg-green-500 items-center justify-center mb-5 shadow-lg">
                  <Ionicons name="person-add" size={40} color="white" />
                </View>

                <Text className="text-3xl font-JakartaBold text-gray-800 mb-2">
                  Create Account
                </Text>
                <Text className="text-base font-JakartaMedium text-gray-500 text-center px-8">
                  Fill in your details to get started
                </Text>
              </Animated.View>
            </View>

            {/* Progress Indicator */}
            <Animated.View
              style={{ opacity: fadeAnim }}
              className="px-6 mb-6"
            >
              <View className="flex-row items-center justify-center space-x-2">
                <View className="flex-row items-center">
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${fullName ? 'bg-green-500' : 'bg-gray-200'}`}>
                    {fullName ? (
                      <Ionicons name="checkmark" size={16} color="white" />
                    ) : (
                      <Text className="text-gray-500 font-JakartaBold text-xs">1</Text>
                    )}
                  </View>
                  <View className={`w-12 h-1 ${mobileNumber ? 'bg-green-500' : 'bg-gray-200'}`} />
                </View>
                <View className="flex-row items-center">
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${mobileNumber ? 'bg-green-500' : 'bg-gray-200'}`}>
                    {mobileNumber ? (
                      <Ionicons name="checkmark" size={16} color="white" />
                    ) : (
                      <Text className="text-gray-500 font-JakartaBold text-xs">2</Text>
                    )}
                  </View>
                  <View className={`w-12 h-1 ${userId ? 'bg-green-500' : 'bg-gray-200'}`} />
                </View>
                <View className={`w-8 h-8 rounded-full items-center justify-center ${userId ? 'bg-green-500' : 'bg-gray-200'}`}>
                  {userId ? (
                    <Ionicons name="checkmark" size={16} color="white" />
                  ) : (
                    <Text className="text-gray-500 font-JakartaBold text-xs">3</Text>
                  )}
                </View>
              </View>
            </Animated.View>

            {/* Form Section */}
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
              className="flex-1 px-6 pb-8"
            >
              <View className="space-y-4">
                {/* Full Name Input */}
                <View className="mb-3">
                  <CustomInput
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    leftIcon={<InputIcon name="person-outline" />}
                    error={!fullName && touched.fullName ? "Full name is required" : ""}
                    touched={touched.fullName}
                    onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
                  />
                </View>

                {/* Mobile Input */}
                <View className="mb-3">
                  <CustomInput
                    label="Mobile Number"
                    placeholder="Enter your mobile number"
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    keyboardType="phone-pad"
                    leftIcon={<InputIcon name="call-outline" />}
                    error={!mobileNumber && touched.mobile ? "Mobile number is required" : ""}
                    touched={touched.mobile}
                    onBlur={() => setTouched((prev) => ({ ...prev, mobile: true }))}
                  />
                </View>

                {/* Specific ID Input */}
                <View className="mb-4">
                  <CustomInput
                    label="Specific ID"
                    placeholder="Enter your specific ID"
                    value={userId}
                    onChangeText={setUserId}
                    autoCapitalize="characters"
                    leftIcon={<InputIcon name="card-outline" />}
                    error={!userId && touched.id ? "Specific ID is required" : ""}
                    touched={touched.id}
                    onBlur={() => setTouched((prev) => ({ ...prev, id: true }))}
                  />
                </View>

                {/* Terms and Conditions */}
                <TouchableOpacity
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  className="flex-row items-start mb-6"
                >
                  <View
                    className={`w-6 h-6 rounded-lg mr-3 items-center justify-center ${
                      acceptedTerms ? "bg-green-500" : "bg-gray-100 border border-gray-300"
                    }`}
                  >
                    {acceptedTerms && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <Text className="flex-1 text-gray-600 font-JakartaMedium text-sm leading-5">
                    I agree to the{" "}
                    <Text className="text-blue-500 font-JakartaSemiBold">
                      Terms of Service
                    </Text>{" "}
                    and{" "}
                    <Text className="text-blue-500 font-JakartaSemiBold">
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>

                {/* Create Account Button */}
                <View className="shadow-lg shadow-green-500/30">
                  <CustomButton
                    title="Create Account"
                    onPress={handleSignup}
                    loading={isLoading}
                    className="h-14 rounded-2xl bg-green-500"
                    IconRight={() => (
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    )}
                  />
                </View>

                {/* Info Card */}
                <View className="bg-blue-50 rounded-2xl p-4 mt-4 flex-row items-start">
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                    <Ionicons name="information" size={20} color="#3B82F6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-blue-800 font-JakartaSemiBold text-sm mb-1">
                      Admin Approval Required
                    </Text>
                    <Text className="text-blue-600 font-JakartaMedium text-xs leading-4">
                      Your account will be activated after admin verification. You'll receive a notification once approved.
                    </Text>
                  </View>
                </View>

                {/* Sign In Link */}
                <View className="flex-row justify-center items-center mt-6 pb-4">
                  <Text className="text-gray-500 font-JakartaMedium text-base">
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.replace("/login")}>
                    <Text className="text-blue-500 font-JakartaBold text-base">
                      Sign In
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}