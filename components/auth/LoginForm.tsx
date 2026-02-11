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
  BackHandler,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomButton from "../ui/CustomButton";
import CustomInput from "../ui/CustomInput";
import {
  login,
  checkMobileExists,
  setPasswordToBackend,
  checkAuthStatus,
} from "@/api/auth";
import { updateDevIP } from "@/constants/api";
import { getDefaultDevIP } from "@/app/index";
import { useSimCards } from "@/hooks/useSimCards";
import Constants from 'expo-constants';

const { DEV_IP, INTERNAL_IP, EXTERNAL_IP } = Constants?.expoConfig?.extra as { DEV_IP: string; INTERNAL_IP: string; EXTERNAL_IP: string };

interface SimCard {
  phoneNumber: string;
  carrierName: string;
  slotIndex: number;
}

type LoginStep = "password" | "setPassword";

export default function LoginForm() {
  // ==================== STATE MANAGEMENT ====================
  
  const [currentStep, setCurrentStep] = useState<LoginStep>("password");
  const [mobileNumber, setMobileNumber] = useState(Platform.OS === "web" ? "5551234567" : "");
  const [password, setPassword] = useState(Platform.OS === "web" ? "1111" : "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingMobile, setIsCheckingMobile] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isMobileAllowed, setIsMobileAllowed] = useState(false);
  const [mobileCheckMessage, setMobileCheckMessage] = useState("");
  const [hasMobileCheckResult, setHasMobileCheckResult] = useState(false);
  const [availableSimCards, setAvailableSimCards] = useState<SimCard[]>([]);
  const [showSimPickerModal, setShowSimPickerModal] = useState(false);
  const [devIP, setDevIP] = useState(DEV_IP);
  const [showIPModal, setShowIPModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [clickCount, setClickCount] = useState(0); // Track taps

  const {
    fetchSimCards,
    isLoading: isFetchingSim,
  } = useSimCards();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    mobile: false,
    password: false,
    confirmPassword: false,
  });

  const lastCheckedNumberRef = useRef<string>("");

  // ==================== AUTH CHECK ON MOUNT ====================

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      setIsCheckingAuth(true);
      const authStatus = await checkAuthStatus();

      if (authStatus.isAuthenticated) {
        console.log("User already authenticated, redirecting...");
        router.replace("/(drawer)");
        return;
      }

      setIsCheckingAuth(false);
      handleFetchMobileNumbers();
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsCheckingAuth(false);
      handleFetchMobileNumbers();
    }
  };

  // ==================== ANIMATIONS ====================

  const animateStepChange = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(callback, 150);
  };

  // ==================== SIM CARD FUNCTIONS ====================

  const handleFetchMobileNumbers = useCallback(async () => {
    Keyboard.dismiss();
    setVerificationStatus("idle");
    setVerificationMessage("");
    setHasMobileCheckResult(false);
    setIsMobileAllowed(false);

    try {
      const simCards = await fetchSimCards();

      if (simCards.length === 0) {
        Alert.alert(
          "Not Supported",
          "Automatic mobile number fetch is not supported on this device. Please enter your mobile number manually.",
          [{ text: "OK" }]
        );
        return;
      }

      if (simCards.length === 1) {
        setMobileNumber(simCards[0].phoneNumber);
        setAvailableSimCards(simCards);
      } else {
        setAvailableSimCards(simCards);
        setShowSimPickerModal(true);
      }
    } catch (error) {
      setVerificationStatus("failed");
      setVerificationMessage("Automatic mobile number fetch is not supported on this device.");
      Alert.alert(
        "Not Supported",
        "Automatic mobile number fetch is not supported on this device. Please enter your mobile number manually.",
        [{ text: "OK" }]
      );
    }
  }, [fetchSimCards]);

  const handleSelectSimCard = (simCard: SimCard) => {
    setMobileNumber(simCard.phoneNumber);
    setShowSimPickerModal(false);
  };

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
          setCurrentStep("password");
          return;
        }

        if (response.canlogin !== 1) {
          setIsMobileAllowed(false);
          const message = "Login not allowed. Please contact your administrator.";
          setMobileCheckMessage(message);
          setVerificationStatus("failed");
          setVerificationMessage(message);
          setCurrentStep("password");
          return;
        }

        setIsMobileAllowed(true);
        setMobileCheckMessage("");
        setVerificationStatus("success");
        setVerificationMessage("");
        setCurrentStep(response.isPasswordSet ? "password" : "setPassword");
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

  useEffect(() => {
    if (!mobileNumber) return;
    verifyMobileNumber(mobileNumber);
  }, [mobileNumber, verifyMobileNumber]);

  const handleBackToMobile = () => {
    animateStepChange(() => {
      setCurrentStep("password");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setTouched({
        mobile: false,
        password: false,
        confirmPassword: false,
      });
    });
  };

  // ==================== LOGIN HANDLER ====================

  const handleLogin = async () => {
    Keyboard.dismiss();
    setTouched((prev) => ({ ...prev, password: true }));

    if (!isMobileAllowed) {
      Alert.alert("Error", mobileCheckMessage || "This mobile number is not allowed to login.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    try {
      setIsLoading(true);

      const cleanedNumber = mobileNumber.replace(/[^0-9]/g, "");
      const response = await login(cleanedNumber, password);

      console.log("Login response:", response);

      if (response.success) {
        router.replace("/(drawer)");
      } else {
        Alert.alert(
          "Login Failed",
          response.message || "Incorrect password. Please check your mobile number or enter the correct password.",
          [
            {
              text: "Try Again",
              style: "default",
            },
          ]
        );
      }
    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert(
        "Error",
        "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

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
      password: true,
      confirmPassword: true,
    }));

    if (!isMobileAllowed) {
      Alert.alert("Error", mobileCheckMessage || "This mobile number is not allowed to login.");
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

      const cleanedNumber = mobileNumber.replace(/[^0-9]/g, "");
      const response = await setPasswordToBackend(cleanedNumber, password);

      console.log("Set password response:", response);

      if (response.success) {
        Alert.alert(
          "",
          "Password Set Successfully",
          [
            { text: "Continue", onPress: () => {
              router.replace("/(drawer)");
            } },
          ]
        );
      } else {
        Alert.alert(
          "Error",
          response.message || "Failed to set password. Please try again."
        );
      }
    } catch (error: any) {
      console.error("Set password error:", error);
      Alert.alert(
        "Error",
        "Something went wrong. Please try again."
      );
    } finally {
      setIsSettingPassword(false);
    }
  };

  // ==================== DEV MODE - BOTTOM RIGHT TAP ====================

  const handleBottomRightPress = () => {
    setClickCount((prevCount) => {
      const newCount = prevCount + 1;
      console.log("Bottom-right tap count:", newCount);

      if (newCount >= 7) {
        console.log("🔧 7 taps detected - opening IP modal");
        setShowIPModal(true);
        return 0; // Reset counter
      }

      // Reset counter after 2 seconds of inactivity
      setTimeout(() => {
        setClickCount(0);
      }, 2000);

      return newCount;
    });
  };

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
      case "password":
        return {
          title: "Welcome",
          subtitle: hasMobileCheckResult
            ? isMobileAllowed
              ? "Enter your password to sign in"
              : mobileCheckMessage || "Unable to login with this number"
            : verificationMessage || "Verifying your mobile number...",
          icon: "lock-closed" as const,
          iconBgColor: "bg-blue-500",
        };
      case "setPassword":
        return {
          title: "Set Password",
          subtitle: "Set a password for your account",
          icon: "key" as const,
          iconBgColor: "bg-blue-500",
        };
    }
  };

  // ==================== RENDER LOADING ====================

  if (isCheckingAuth) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-500">Checking authentication...</Text>
      </View>
    );
  }

  // ==================== RENDER STEPS ====================

  const renderPasswordStep = () => (
    <View pointerEvents={verificationStatus !== "success" ? "none" : "auto"}>
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
        rightIcon={
          <Pressable
            onPress={handleFetchMobileNumbers}
            disabled={isFetchingSim}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="bg-blue-100 p-2 rounded-lg"
          >
            {isFetchingSim ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color="#3B82F6"
              />
            )}
          </Pressable>
        }
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

      <View className="mb-6 mt-4">
        <CustomInput
          label=""
          placeholder="Enter password"
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
        <Pressable
          onPress={() =>
            animateStepChange(() => {
              setCurrentStep("setPassword");
              setConfirmPassword("");
              setShowConfirmPassword(false);
              setTouched((prev) => ({
                ...prev,
                password: false,
                confirmPassword: false,
              }));
            })
          }
          disabled={false}
          className="mt-2"
        >
          <Text className="text-right text-sm text-blue-500 font-JakartaMedium">
            Forgot password?
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleLogin}
        onLongPress={handleLongPressButton}
        delayLongPress={3000}
        disabled={false && (isLoading || !isMobileAllowed || isCheckingMobile || Platform.OS === "web" ? false : true)}
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
                <Ionicons name="arrow-forward" size={20} color="white" />
              )}
            />
          </View>
        )}
      </Pressable>
    </View>
  );

  const renderSetPasswordStep = () => (
    <View pointerEvents={verificationStatus !== "success" ? "none" : "auto"}>
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
        rightIcon={
          <Pressable
            onPress={handleFetchMobileNumbers}
            disabled={isFetchingSim}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="bg-blue-100 p-2 rounded-lg"
          >
            {isFetchingSim ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color="#3B82F6"
              />
            )}
          </Pressable>
        }
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

      <View className="mb-4 mt-4">
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

      <View className="mb-4 ml-1" />

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

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "password":
        return renderPasswordStep();
      case "setPassword":
        return renderSetPasswordStep();
      default:
        return renderPasswordStep();
    }
  };

  const headerConfig = getHeaderConfig();

  // ==================== MAIN RENDER ====================
  const handleClose = () => {
    setVerificationStatus("idle");
    setVerificationMessage("");
    setMobileNumber("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    BackHandler.exitApp();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Modal
        visible={verificationStatus === "pending" || verificationStatus === "failed"}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (verificationStatus === "failed") {
            handleClose();
          }
        }}
      >
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", paddingHorizontal: 20 }
          ]}
          pointerEvents="auto"
        >
          <View
            className="bg-white rounded-2xl px-6 py-5 items-center shadow-lg"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 10,
              paddingTop: 60,
              paddingBottom: 60,
            }}
          >
            {(isCheckingMobile || verificationStatus === "pending") && (
              <ActivityIndicator size="large" color="#3B82F6" />
            )}
            <Text className="text-base font-JakartaSemiBold text-gray-800 text-center mt-3">
              {verificationMessage || `Verifying ${mobileNumber || "your number"}...`}
            </Text>
          </View>
          {verificationStatus === "failed" && (
            <View className="mt-4 items-center">
              <Pressable
                onPress={handleClose}
                className="px-4 py-2 bg-gray-100 rounded-lg"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text className="text-sm text-gray-700">Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

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
            <View className="items-center mb-8">
              <View
                className={`w-20 h-20 rounded-2xl items-center justify-center mb-5 ${headerConfig.iconBgColor}`}
              >
                <Ionicons
                  name={headerConfig.icon}
                  size={40}
                  color="white"
                />
              </View>
              <Text className="text-2xl font-JakartaBold text-gray-800 mb-2">
                {headerConfig.title}
              </Text>
            </View>

            <Animated.View
              style={{ opacity: fadeAnim }}
            >
              {renderCurrentStep()}
            </Animated.View>
          </View>

          {/* Bottom-right corner tap area */}
          <Pressable
            onPress={handleBottomRightPress}
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: 80,
              height: 80,
              // backgroundColor: 'rgba(255,0,0,0.1)', // Uncomment for debugging
            }}
          />
        </Pressable>
      </ScrollView>

      {/* SIM Card Picker Modal */}
      <Modal
        visible={showSimPickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSimPickerModal(false)}
      >
        <Pressable
          onPress={() => setShowSimPickerModal(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable
            onPress={() => {}}
            className="bg-white rounded-t-3xl pt-6 pb-8 px-5"
          >
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <Text className="text-xl font-JakartaBold text-gray-800 mb-2">
              Choose Your Number
            </Text>
            <Text className="text-sm text-gray-500 mb-5">
              Multiple SIM cards detected. Please select which number to use.
            </Text>

            {availableSimCards.map((sim, index) => (
              <Pressable
                key={index}
                onPress={() => handleSelectSimCard(sim)}
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3 flex-row items-center active:bg-gray-100"
              >
                <View className="bg-blue-500 p-3 rounded-xl mr-4">
                  <Ionicons name="phone-portrait" size={24} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-500">
                    SIM {sim.slotIndex + 1} • {sim.carrierName}
                  </Text>
                  <Text className="text-lg font-JakartaBold text-gray-800">
                    {sim.phoneNumber}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </Pressable>
            ))}

            <Pressable
              onPress={() => {
                setShowSimPickerModal(false);
                setMobileNumber("");
              }}
              className="mt-2 py-3 flex-row items-center justify-center"
            >
              <Ionicons name="keypad-outline" size={18} color="#6B7280" />
              <Text className="text-gray-500 ml-2">Enter number manually</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
              value={devIP?.replace(/^https?:\/\//, "")}
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
                    setClickCount(0);
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
                    setClickCount(0);
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