// components/forms/LoginForm.tsx
import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
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
  ActivityIndicator,
  Animated,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomButton from "./ui/CustomButton";
import CustomInput from "./ui/CustomInput";
import {
  checkMobileExists,
  changePassword,
  logout,
} from "@/api/auth";
import { updateDevIP } from "@/constants/api";
import { getDefaultDevIP } from "@/app/index";
import { AuthStorage } from "@/utils/authStorage";
import { ToastAndroid } from "react-native";
type LoginStep = "setPassword";

export default function ChangePassword() {
  // ==================== STATE MANAGEMENT ====================
  
  // Step management (single step)
  const currentStep: LoginStep = "setPassword";

  // Form fields
const [mobileNumber, setMobileNumber] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Loading states
  const [isCheckingMobile, setIsCheckingMobile] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isMobileAllowed, setIsMobileAllowed] = useState(false);
  const [mobileCheckMessage, setMobileCheckMessage] = useState("");
  const [hasMobileCheckResult, setHasMobileCheckResult] = useState(false);

  // UI states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    mobile: false,
    currentPassword: false,
    password: false,
    confirmPassword: false,
  });

// Dev mode states
  const [devIP, setDevIP] = useState(getDefaultDevIP());
  const [showIPModal, setShowIPModal] = useState(false);

  // Animation
  const [fadeAnim] = useState(new Animated.Value(1));

  // Track last checked number to avoid duplicate calls
  const lastCheckedNumberRef = useRef<string>("");

  // ==================== MOBILE VERIFICATION ====================

  const verifyMobileNumber = useCallback(
    async (number: string) => {
      const cleanedNumber = number.replace(/[^0-9]/g, "");
      if (cleanedNumber.length < 10 || lastCheckedNumberRef.current === cleanedNumber) {
        return;
      }

      try {
        setIsCheckingMobile(true);
        setMobileCheckMessage("");
        setVerificationStatus("pending");
        setVerificationMessage(`Verifying ${cleanedNumber}...`);

        const response = await checkMobileExists(cleanedNumber);
        console.log("Response in check mobile exists:", response);
        setHasMobileCheckResult(true);
        lastCheckedNumberRef.current = cleanedNumber;

        if (!response.exists) {
          setIsMobileAllowed(false);
          const message = `Mobile number ${cleanedNumber} is not registered. Please contact your administrator.`;
          setMobileCheckMessage(message);
          setVerificationStatus("failed");
          setVerificationMessage(message);
          return;
        }

        if (response.canlogin !== 1) {
          setIsMobileAllowed(false);
          const message = "Login not allowed. Please contact your administrator.";
          setMobileCheckMessage(message);
          setVerificationStatus("failed");
          setVerificationMessage(message);
          return;
        }

        // Allowed
        setIsMobileAllowed(true);
        setMobileCheckMessage("");
        setVerificationStatus("success");
        setVerificationMessage("");
      } catch (error: any) {
        console.error("Check mobile error:", error);
        setIsMobileAllowed(false);
        setHasMobileCheckResult(true);
        const message = error.message || "Unable to verify mobile number. Please try again.";
        setMobileCheckMessage(message);
        setVerificationStatus("failed");
        setVerificationMessage(message);
      } finally {
        setIsCheckingMobile(false);
      }
    },
    []
  );

  // Fetch mobile number from storage and trigger verification
  const handleFetchMobileFromStorage = useCallback(async () => {
    Keyboard.dismiss();
    setVerificationStatus("pending");
    setVerificationMessage("Fetching your mobile number...");
    setHasMobileCheckResult(false);
    setIsMobileAllowed(false);
    try {
      const storedUser = await AuthStorage.getUser();
      const number = storedUser?.mobileNumber || storedUser?.mobileno || storedUser?.mobileNumber || "";
      if (number) {
        setMobileNumber(number);
        verifyMobileNumber(number);
      } else {
        setVerificationStatus("failed");
        setVerificationMessage("Mobile number not found.");
      }
    } catch (error) {
      setVerificationStatus("failed");
      setVerificationMessage("Unable to fetch mobile number.");
    }
  }, [verifyMobileNumber]);

  // On mount, fetch mobile from storage and verify
  useEffect(() => {
    handleFetchMobileFromStorage();
  }, [handleFetchMobileFromStorage]);

  useEffect(() => {
    if (!mobileNumber) return;
    verifyMobileNumber(mobileNumber);
  }, [mobileNumber, verifyMobileNumber]);

  // ==================== SET PASSWORD HANDLER ====================

  const validatePassword = (pwd: string): { valid: boolean; message: string } => {
    if (pwd.length < 4) {
      return { valid: false, message: "Password must be at least 4 characters" };
    }
    if (pwd.length > 20) {
      return { valid: false, message: "Password must be less than 20 characters" };
    }
    return { valid: true, message: "" };
  };

  const handleSetPassword = async () => {
    Keyboard.dismiss();
    setTouched((prev) => ({
      ...prev,
      currentPassword: true,
      password: true,
      confirmPassword: true,
    }));

    if (!isMobileAllowed) {
      Alert.alert("Error", mobileCheckMessage || "This mobile number is not allowed to login.");
      return;
    }

    if (!currentPassword.trim()) {
      Alert.alert("Error", "Please enter your current password");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Error", "Please enter a password");
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      Alert.alert("Error", validation.message);
      return;
    }

    if (!confirmPassword.trim()) {
      Alert.alert("Error", "Please confirm your password");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      setIsSettingPassword(true);
      setVerificationStatus("pending");
      setVerificationMessage("Verifying your current password...");

      const cleanedNumber = mobileNumber.replace(/[^0-9]/g, "");
      console.log("cleanedNumber in handleSetPassword", cleanedNumber);
      console.log("currentPassword in handleSetPassword", currentPassword);
      console.log("password in handleSetPassword", password);
      const response = await changePassword(cleanedNumber, currentPassword, password);

      console.log("Set password response:", response);

      if (response.success) {
        await logout();
        ToastAndroid.show("Password changed successfully. Please log in again.", ToastAndroid.SHORT);
        router.replace("/(auth)/login");
      } else {
        const message = response.message || "Failed to change password. Please try again.";
        setVerificationStatus("failed");
        setVerificationMessage(message);
        Alert.alert("Error", message);
      }
    } catch (error: any) {
      console.error("Set password error:", error);
      const message = error?.response?.data?.message || "Something went wrong. Please try again.";
      setVerificationStatus("failed");
      setVerificationMessage(message);
      Alert.alert("Error", message);
    } finally {
      setIsSettingPassword(false);
      if (verificationStatus === "pending") {
        setVerificationStatus("success");
        setVerificationMessage("");
      }
    }
  };

  // ==================== DEV MODE ====================

  const handleLongPressButton = () => {
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

  const handleBackgroundPress = () => {
    Keyboard.dismiss();
  };

  // ==================== HEADER CONFIG ====================

  const getHeaderConfig = () => {
    switch (currentStep) {
      case "setPassword":
        return {
          title: "Change Password",
          subtitle: hasMobileCheckResult
            ? isMobileAllowed
              ? "Set a new password for your account"
              : mobileCheckMessage || "Unable to proceed with this number"
            : verificationMessage || "Verifying your mobile number...",
          icon: "key" as const,
          iconBgColor: "bg-blue-500",
        };
    }
  };

  // ==================== RENDER STEPS ====================

  const renderSetPasswordStep = () => (
    <View pointerEvents={verificationStatus !== "success" ? "none" : "auto"}>
      {/* Mobile Number Display */}
      <CustomInput
          label=""
          placeholder="Enter 10-digit mobile number"
          value={mobileNumber}
          onChangeText={setMobileNumber}
          editable={false}
          keyboardType="phone-pad"
          maxLength={10}
          leftIcon={
            <Ionicons name="call-outline" size={20} color="#6B7280" />
          }
          rightIcon={null}
          error={
            !mobileNumber && touched.mobile ? "Mobile number is required" : ""
          }
          touched={touched.mobile}
          onBlur={() => setTouched((prev) => ({ ...prev, mobile: true }))}
        />
      {isCheckingMobile && (
        <View className="flex-row items-center mt-2">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text className="ml-2 text-xs text-gray-500">Verifying mobile number...</Text>
        </View>
      )}
      {!!mobileCheckMessage && (
        <Text className="mt-2 text-sm text-red-500">{mobileCheckMessage}</Text>
      )}

      {/* Current Password Input */}
      <View className="mb-4 mt-4">
        <CustomInput
          label=""
          placeholder="Enter current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry={!showCurrentPassword}
          editable={isMobileAllowed && !isCheckingMobile}
          leftIcon={
            <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showCurrentPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color="#6B7280"
              />
            </Pressable>
          }
          error={!currentPassword && touched.currentPassword ? "Current password is required" : ""}
          touched={touched.currentPassword}
          onBlur={() => setTouched((prev) => ({ ...prev, currentPassword: true }))}
        />
      </View>

      {/* New Password Input */}
      <View className="mb-4">
        <CustomInput
          label=""
          placeholder="Enter new password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          editable={isMobileAllowed && !isCheckingMobile}
          leftIcon={
            <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
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
          error={!password && touched.password ? "Password is required" : ""}
          touched={touched.password}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
        />
      </View>

      {/* Confirm Password Input */}
      <View className="mb-6">
        <CustomInput
          label=""
          placeholder="Re-enter password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          editable={isMobileAllowed && !isCheckingMobile}
          leftIcon={
            <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color="#6B7280"
              />
            </Pressable>
          }
          error={
            touched.confirmPassword && confirmPassword && password !== confirmPassword
              ? "Passwords do not match"
              : !confirmPassword && touched.confirmPassword
              ? "Please confirm your password"
              : ""
          }
          touched={touched.confirmPassword}
          onBlur={() =>
            setTouched((prev) => ({ ...prev, confirmPassword: true }))
          }
        />

        {/* Match indicator */}
        {confirmPassword.length > 0 && (
          <View className="flex-row items-center mt-2 ml-1">
            <Ionicons
              name={
                password === confirmPassword
                  ? "checkmark-circle"
                  : "close-circle"
              }
              size={14}
              color={password === confirmPassword ? "#22C55E" : "#EF4444"}
            />
            <Text
              className={`text-xs ml-1 ${
                password === confirmPassword
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {password === confirmPassword
                ? "Passwords match"
                : "Passwords do not match"}
            </Text>
          </View>
        )}
      </View>

            {/* Password Requirements */}
            <View className="mb-4 ml-1">
      </View>

      {/* Set Password Button */}
      <Pressable
        onPress={handleSetPassword}
        onLongPress={handleLongPressButton}
        delayLongPress={3000}
          disabled={isSettingPassword || !isMobileAllowed || isCheckingMobile}
      >
        {({ pressed }) => (
          <View
            pointerEvents="none"
            style={{ opacity: pressed ? 0.8 : 1 }}
          >
            <CustomButton
              title="Save Password"
              onPress={() => {}}
              loading={isSettingPassword}
              bgVariant="primary"
            />
          </View>
        )}
      </Pressable>

    </View>
  );

  const headerConfig = getHeaderConfig();

  // ==================== MAIN RENDER ====================

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Full Screen Overlay - Now outside ScrollView for full coverage */}
      {(verificationStatus === "pending" || verificationStatus === "failed") && (
  <View
    style={[
      StyleSheet.absoluteFillObject,
      { 
        backgroundColor: 'rgba(0, 0, 0, 0.4)', 
        zIndex: 10
      }
    ]}
    pointerEvents="auto"
  >
          {/* Popup positioned below header */}
          <View 
            style={{ 
              marginTop: 190, // Position below Welcome text
              paddingHorizontal: 20,
              width: '100%',
            }}
          >
            <View 
              className="bg-white rounded-2xl px-6 py-5 items-center shadow-lg"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 10,
                paddingTop: 90,
                paddingBottom: 90,
              }}
            >
               {(isCheckingMobile || verificationStatus === "pending") && (
                <ActivityIndicator size="large" color="#3B82F6" />
              )}
              <Text className="text-base font-JakartaSemiBold text-gray-800 text-center mt-3">
                {verificationMessage || `Verifying ${mobileNumber || "your number"}...`}
              </Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Pressable
          onPress={handleBackgroundPress}
          className="flex-1 bg-white justify-start"
        >
          <View className="flex-1 px-[10%] pt-8">
            {/* Form Section with Animation */}
            <Animated.View
              style={{ opacity: fadeAnim }}
            >
              {renderSetPasswordStep()}
            </Animated.View>
          </View>
        </Pressable>
      </ScrollView>



      {/* IP Modal - Developer Mode */}
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