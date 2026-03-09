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
import { useApiStore } from "@/stores/apiStore";
import { useSimCards } from "@/hooks/useSimCards";
import Constants from "expo-constants";

const { DEV_IP, INTERNAL_IP, EXTERNAL_IP } = Constants?.expoConfig?.extra as {
  DEV_IP: string;
  INTERNAL_IP: string;
  EXTERNAL_IP: string;
};

// ==================== DEBUG FLAG ====================
// Set to true during development to allow manual mobile entry when SIM fetch fails
const IS_DEBUG = __DEV__ ?? true;

interface SimCard {
  phoneNumber: string;
  carrierName: string;
  slotIndex: number;
}

type LoginStep = "password" | "setPassword";

export default function LoginForm() {
  // ==================== STATE MANAGEMENT ====================

  const [currentStep, setCurrentStep] = useState<LoginStep>("password");
  const [mobileNumber, setMobileNumber] = useState(
    IS_DEBUG ? "5551234567" : ""
  );
  const [password, setPassword] = useState(IS_DEBUG ? "1111" : "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingMobile, setIsCheckingMobile] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "pending" | "success" | "failed"
  >("idle");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isMobileAllowed, setIsMobileAllowed] = useState(false);
  const [mobileCheckMessage, setMobileCheckMessage] = useState("");
  const [hasMobileCheckResult, setHasMobileCheckResult] = useState(false);
  const [availableSimCards, setAvailableSimCards] = useState<SimCard[]>([]);
  const [showSimPickerModal, setShowSimPickerModal] = useState(false);
  const [devIP, setDevIP] = useState(DEV_IP);
  const [showIPModal, setShowIPModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [clickCount, setClickCount] = useState(0);

  // Debug mode: allows manual mobile entry when SIM fetch fails
  const [isManualEntry, setIsManualEntry] = useState(false);

  const { fetchSimCards, isLoading: isFetchingSim } = useSimCards();

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

  // ==================== RESET STATE FUNCTIONS ====================

  const resetVerificationState = useCallback(() => {
    setVerificationStatus("idle");
    setVerificationMessage("");
    setHasMobileCheckResult(false);
    setIsMobileAllowed(false);
    setMobileCheckMessage("");
    lastCheckedNumberRef.current = "";
  }, []);

  const resetFormState = useCallback(() => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setTouched({
      mobile: false,
      password: false,
      confirmPassword: false,
    });
  }, []);

  // ==================== SIM CARD FUNCTIONS ====================

  const handleFetchMobileNumbers = useCallback(async () => {
    Keyboard.dismiss();

    // Reset all states for fresh verification
    resetVerificationState();
    resetFormState();
    setMobileNumber("");
    setCurrentStep("password");
    setIsManualEntry(false);

    try {
      const simCards = await fetchSimCards();

      if (simCards.length === 0) {
        if (IS_DEBUG) {
          // Debug mode: allow manual entry instead of closing app
          console.log(
            "🔧 DEBUG: SIM fetch returned 0 cards — enabling manual entry"
          );
          setIsManualEntry(true);
          setMobileNumber("5551234567");
          setPassword("1111");
          Alert.alert(
            "Debug Mode",
            "SIM card fetch not supported on this device.\nManual entry enabled for debugging.",
            [{ text: "OK" }]
          );
          return;
        }

        Alert.alert(
          "Not Supported",
          "Automatic mobile number fetch is not supported on this device.",
          [
            {
              text: "Close App",
              onPress: () => BackHandler.exitApp(),
              style: "destructive",
            },
          ],
          { cancelable: false }
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
      if (IS_DEBUG) {
        // Debug mode: allow manual entry on error
        console.log(
          "🔧 DEBUG: SIM fetch failed — enabling manual entry",
          error
        );
        setIsManualEntry(true);
        setMobileNumber("5551234567");
        setPassword("1111");
        Alert.alert(
          "Debug Mode",
          "SIM card fetch failed.\nManual entry enabled for debugging.",
          [{ text: "OK" }]
        );
        return;
      }

      Alert.alert(
        "Not Supported",
        "Automatic mobile number fetch is not supported on this device.",
        [
          {
            text: "Close App",
            onPress: () => BackHandler.exitApp(),
            style: "destructive",
          },
        ],
        { cancelable: false }
      );
    }
  }, [fetchSimCards, resetVerificationState, resetFormState]);

  const handleSelectSimCard = (simCard: SimCard) => {
    // Reset verification state when selecting a new SIM
    resetVerificationState();
    resetFormState();
    setMobileNumber(simCard.phoneNumber);
    setShowSimPickerModal(false);
    setIsManualEntry(false);
  };

  // ==================== MOBILE NUMBER CHANGE HANDLER (manual entry) ====================

  const handleMobileNumberChange = useCallback(
    (text: string) => {
      // Only allow digits
      const cleaned = text.replace(/[^0-9]/g, "");
      setMobileNumber(cleaned);

      // Reset verification when number changes in manual mode
      if (isManualEntry) {
        resetVerificationState();
      }
    },
    [isManualEntry, resetVerificationState]
  );

  // ==================== MOBILE VERIFICATION ====================

  const verifyMobileNumber = useCallback(async (number: string) => {
    const cleanedNumber = number.replace(/[^0-9]/g, "");

    if (cleanedNumber.length < 10) {
      return;
    }

    // Skip if already checked this number
    if (lastCheckedNumberRef.current === cleanedNumber) {
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
        const message =
          "Login not allowed. Please contact your administrator.";
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
      const message =
        error.message || "Unable to verify mobile number. Please try again.";
      setMobileCheckMessage(message);
      setVerificationStatus("failed");
      setVerificationMessage(message);
    } finally {
      setIsCheckingMobile(false);
    }
  }, []);

  const apiUrlReady = useApiStore((s) => s.apiUrlReady);

  useEffect(() => {
    if (!mobileNumber) return;
    if (!apiUrlReady) return;
    verifyMobileNumber(mobileNumber);
  }, [mobileNumber, verifyMobileNumber, apiUrlReady]);

  // ==================== NAVIGATION HANDLERS ====================

  const handleBackToLogin = () => {
    animateStepChange(() => {
      setCurrentStep("password");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setTouched((prev) => ({
        ...prev,
        password: false,
        confirmPassword: false,
      }));
    });
  };

  const handleGoToSetPassword = () => {
    if (!isMobileAllowed || isCheckingMobile) return;

    animateStepChange(() => {
      setCurrentStep("setPassword");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setTouched((prev) => ({
        ...prev,
        password: false,
        confirmPassword: false,
      }));
    });
  };

  // ==================== LOGIN HANDLER ====================

  const handleLogin = async () => {
    Keyboard.dismiss();
    setTouched((prev) => ({ ...prev, password: true }));

    if (!isMobileAllowed) {
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
          response.message ||
            "Incorrect password. Please check your mobile number or enter the correct password.",
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
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== SET PASSWORD HANDLER ====================

  const validatePassword = (
    pwd: string
  ): { valid: boolean; message: string } => {
    if (pwd.length < 4) {
      return {
        valid: false,
        message: "Password must be at least 4 characters",
      };
    }
    if (pwd.length > 20) {
      return {
        valid: false,
        message: "Password must be less than 20 characters",
      };
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
        Alert.alert("", "Password Set Successfully", [
          {
            text: "Continue",
            onPress: () => {
              router.replace("/(drawer)");
            },
          },
        ]);
      } else {
        Alert.alert(
          "Error",
          response.message || "Failed to set password. Please try again."
        );
      }
    } catch (error: any) {
      console.error("Set password error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSettingPassword(false);
    }
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
          subtitle: isCheckingMobile
            ? "Verifying your mobile number..."
            : hasMobileCheckResult
              ? isMobileAllowed
                ? "Enter your password to sign in"
                : ""
              : isManualEntry
                ? "Enter your mobile number and password"
                : "Please wait...",
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

  // ==================== HELPER: Check if form is disabled ====================

  const isFormDisabled = !isMobileAllowed || isCheckingMobile || isFetchingSim;

  // ==================== RENDER LOADING ====================

  if (isCheckingAuth) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-500">Checking authentication...</Text>
      </View>
    );
  }

  // ==================== RENDER MOBILE INPUT SECTION ====================

  const renderMobileInputSection = () => (
    <>
      <CustomInput
        label=""
        placeholder="Enter 10-digit mobile number"
        value={mobileNumber}
        onChangeText={
          isManualEntry ? handleMobileNumberChange : setMobileNumber
        }
        editable={isManualEntry}
        keyboardType="phone-pad"
        maxLength={10}
        leftIcon={
          <Ionicons name="call-outline" size={20} color="#6B7280" />
        }
        rightIcon={
          <View className="flex-row items-center">
            {/* Debug badge shown when manual entry is active */}
            {isManualEntry && IS_DEBUG && (
              <View className="bg-amber-100 border border-amber-300 rounded-md px-2 py-0.5 mr-2">
                <Text className="text-amber-700 text-[10px] font-JakartaBold">
                  DEBUG
                </Text>
              </View>
            )}
            <Pressable
              onPress={handleFetchMobileNumbers}
              disabled={isFetchingSim || isCheckingMobile}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className={`p-2 rounded-lg ${
                isFetchingSim || isCheckingMobile
                  ? "bg-gray-100"
                  : "bg-blue-100"
              }`}
            >
              {isFetchingSim ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Ionicons
                  name="phone-portrait-outline"
                  size={20}
                  color={isCheckingMobile ? "#9CA3AF" : "#3B82F6"}
                />
              )}
            </Pressable>
          </View>
        }
        error={
          !mobileNumber && touched.mobile ? "Mobile number is required" : ""
        }
        touched={touched.mobile}
        onBlur={() => setTouched((prev) => ({ ...prev, mobile: true }))}
      />

      {/* Manual entry hint in debug mode */}
      {isManualEntry && IS_DEBUG && !isCheckingMobile && !hasMobileCheckResult && (
        <View className="flex-row items-center mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Ionicons
            name="bug-outline"
            size={16}
            color="#D97706"
            style={{ marginTop: 1 }}
          />
          <Text className="ml-2 text-xs text-amber-700 flex-1">
            Debug mode: Enter any registered mobile number manually.
            {"\n"}SIM auto-detect is not available on this device.
          </Text>
        </View>
      )}

      {/* Verification Status - shown below mobile input */}
      {isCheckingMobile && (
        <View className="flex-row items-center mt-2">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text className="ml-2 text-xs text-blue-500">
            Verifying {mobileNumber}...
          </Text>
        </View>
      )}

      {/* Error message - shown below mobile input */}
      {!!mobileCheckMessage && !isCheckingMobile && (
        <View className="flex-row items-start mt-2">
          <Ionicons
            name="warning"
            size={16}
            color="#EF4444"
            style={{ marginTop: 1 }}
          />
          <Text className="ml-2 text-sm text-red-500 flex-1">
            {mobileCheckMessage}
          </Text>
        </View>
      )}

      {/* Success indicator */}
      {isMobileAllowed && !isCheckingMobile && hasMobileCheckResult && (
        <View className="flex-row items-center mt-2">
          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
          <Text className="ml-2 text-xs text-green-600">
            Mobile number verified
          </Text>
        </View>
      )}
    </>
  );

  // ==================== RENDER STEPS ====================

  const renderPasswordStep = () => (
    <View>
      {renderMobileInputSection()}

      <View className="mb-6 mt-4">
        <CustomInput
          label=""
          placeholder="Enter password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          editable={isMobileAllowed && !isCheckingMobile && !isFetchingSim}
          leftIcon={
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={isFormDisabled ? "#D1D5DB" : "#6B7280"}
            />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isFormDisabled}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={isFormDisabled ? "#D1D5DB" : "#6B7280"}
              />
            </Pressable>
          }
          error={!password && touched.password ? "Password is required" : ""}
          touched={touched.password}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
        />
        <Pressable
          onPress={handleGoToSetPassword}
          disabled={isFormDisabled}
          className="mt-2"
        >
          <Text
            className={`text-right text-sm font-JakartaMedium ${
              isFormDisabled ? "text-gray-400" : "text-blue-500"
            }`}
          >
            Forgot password?
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleLogin}
        onLongPress={handleLongPressButton}
        delayLongPress={3000}
        disabled={isLoading || isFormDisabled}
      >
        {({ pressed }) => (
          <View
            pointerEvents="none"
            style={{
              opacity:
                isLoading || isFormDisabled ? 0.5 : pressed ? 0.8 : 1,
            }}
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
    <View>
      {renderMobileInputSection()}

      <View className="mb-4 mt-4">
        <CustomInput
          label=""
          placeholder="Enter new password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          editable={isMobileAllowed && !isCheckingMobile && !isFetchingSim}
          leftIcon={
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={isFormDisabled ? "#D1D5DB" : "#6B7280"}
            />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isFormDisabled}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={isFormDisabled ? "#D1D5DB" : "#6B7280"}
              />
            </Pressable>
          }
          error={!password && touched.password ? "Password is required" : ""}
          touched={touched.password}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
        />
      </View>

      <View className="mb-4">
        <CustomInput
          label=""
          placeholder="Re-enter password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          editable={isMobileAllowed && !isCheckingMobile && !isFetchingSim}
          leftIcon={
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={isFormDisabled ? "#D1D5DB" : "#6B7280"}
            />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isFormDisabled}
            >
              <Ionicons
                name={
                  showConfirmPassword ? "eye-outline" : "eye-off-outline"
                }
                size={20}
                color={isFormDisabled ? "#D1D5DB" : "#6B7280"}
              />
            </Pressable>
          }
          error={
            touched.confirmPassword &&
            confirmPassword &&
            password !== confirmPassword
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

      {/* Back to Login link */}
      <Pressable
        onPress={handleBackToLogin}
        disabled={isSettingPassword}
        className="mb-4 py-2"
      >
        <View className="flex-row items-center justify-center">
          <Ionicons
            name="arrow-back"
            size={16}
            color={isSettingPassword ? "#9CA3AF" : "#3B82F6"}
          />
          <Text
            className={`ml-1 text-sm font-JakartaMedium ${
              isSettingPassword ? "text-gray-400" : "text-blue-500"
            }`}
          >
            Back to Login
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={handleSetPassword}
        onLongPress={handleLongPressButton}
        delayLongPress={3000}
        disabled={isSettingPassword || isFormDisabled}
      >
        {({ pressed }) => (
          <View
            pointerEvents="none"
            style={{
              opacity:
                isSettingPassword || isFormDisabled
                  ? 0.5
                  : pressed
                    ? 0.8
                    : 1,
            }}
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
        <Pressable
          onPress={handleBackgroundPress}
          className="flex-1 bg-white justify-start"
        >
          <View className="flex-1 px-[10%] pt-8">
            {/* Debug mode banner at top */}
            {IS_DEBUG && isManualEntry && (
              <View className="bg-amber-500 rounded-xl px-4 py-2 mb-4 flex-row items-center justify-center">
                <Ionicons name="bug" size={16} color="#FFFFFF" />
                <Text className="text-white text-xs font-JakartaBold ml-2">
                  DEBUG MODE — Manual Entry Enabled
                </Text>
              </View>
            )}

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

            <Animated.View style={{ opacity: fadeAnim }}>
              {renderCurrentStep()}
            </Animated.View>
          </View>
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
                  <Ionicons
                    name="phone-portrait"
                    size={24}
                    color="white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-500">
                    SIM {sim.slotIndex + 1} • {sim.carrierName}
                  </Text>
                  <Text className="text-lg font-JakartaBold text-gray-800">
                    {sim.phoneNumber}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color="#6B7280"
                />
              </Pressable>
            ))}

            <Pressable
              onPress={() => {
                setShowSimPickerModal(false);
                setMobileNumber("");
                resetVerificationState();

                if (IS_DEBUG) {
                  setIsManualEntry(true);
                }
              }}
              className="mt-2 py-3 flex-row items-center justify-center"
            >
              <Ionicons
                name="keypad-outline"
                size={18}
                color="#6B7280"
              />
              <Text className="text-gray-500 ml-2">
                Enter number manually
              </Text>
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