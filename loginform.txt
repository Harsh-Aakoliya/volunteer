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
  AppState,
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
import { useApiStore } from "@/stores/apiStore";
import { useSimCards } from "@/hooks/useSimCards";

// ==================== DEBUG FLAG ====================
const IS_DEBUG = false;

interface SimCard {
  phoneNumber: string;
  carrierName: string;
  slotIndex: number;
}

type LoginStep = "password" | "setPassword";

export default function LoginForm() {
  // ==================== STATE MANAGEMENT ====================

  const [currentStep, setCurrentStep] = useState<LoginStep>("password");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingMobile, setIsCheckingMobile] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isMobileAllowed, setIsMobileAllowed] = useState(false);
  const [mobileCheckMessage, setMobileCheckMessage] = useState("");
  const [hasMobileCheckResult, setHasMobileCheckResult] = useState(false);
  const [availableSimCards, setAvailableSimCards] = useState<SimCard[]>([]);
  const [showSimPickerModal, setShowSimPickerModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  // Track if SIM fetch is needed after permission grant
  const [needsSimFetch, setNeedsSimFetch] = useState(false);
  const [simFetchAttempted, setSimFetchAttempted] = useState(false);

  // Manual entry mode - always true in debug mode
  const [isManualEntry, setIsManualEntry] = useState(IS_DEBUG);

  const { fetchSimCards, isLoading: isFetchingSim } = useSimCards();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    mobile: false,
    password: false,
    confirmPassword: false,
  });

  const lastCheckedNumberRef = useRef<string>("");
  const appStateRef = useRef(AppState.currentState);
  const simFetchInProgressRef = useRef(false);
  const verificationInProgressRef = useRef(false);
  const pendingVerificationRef = useRef<string | null>(null);

  const apiUrlReady = useApiStore((s) => s.apiUrlReady);

  // ==================== AUTH CHECK ON MOUNT ====================

  useEffect(() => {
    checkExistingAuth();
  }, []);

  // ==================== APP STATE LISTENER ====================
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came back to foreground
        console.log("App resumed from background");
        
        // If we were waiting for permission, retry SIM fetch
        if (needsSimFetch && !simFetchInProgressRef.current) {
          console.log("Retrying SIM fetch after permission dialog");
          setTimeout(() => {
            handleFetchMobileNumbers();
          }, 500); // Small delay to ensure app is fully active
        }
        
        // If there's a pending verification, trigger it
        if (pendingVerificationRef.current && !verificationInProgressRef.current) {
          console.log("Retrying pending verification after app resume");
          const numberToVerify = pendingVerificationRef.current;
          pendingVerificationRef.current = null;
          setTimeout(() => {
            verifyMobileNumber(numberToVerify);
          }, 300);
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [needsSimFetch]);

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

      if (IS_DEBUG) {
        console.log("🔧 DEBUG MODE: Manual entry enabled, skipping SIM fetch");
        setIsManualEntry(true);
        return;
      }

      // Production mode: fetch SIM cards
      setTimeout(() => {
        handleFetchMobileNumbers();
      }, 300);
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsCheckingAuth(false);

      if (IS_DEBUG) {
        setIsManualEntry(true);
        return;
      }

      setTimeout(() => {
        handleFetchMobileNumbers();
      }, 300);
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
    setHasMobileCheckResult(false);
    setIsMobileAllowed(false);
    setMobileCheckMessage("");
    lastCheckedNumberRef.current = "";
    verificationInProgressRef.current = false;
    pendingVerificationRef.current = null;
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

  // ==================== SIM CARD FUNCTIONS (Production Only) ====================

  const handleFetchMobileNumbers = useCallback(async () => {
    if (IS_DEBUG) {
      console.log("🔧 DEBUG MODE: SIM fetch skipped");
      setIsManualEntry(true);
      return;
    }

    // Prevent concurrent fetches
    if (simFetchInProgressRef.current) {
      console.log("SIM fetch already in progress, skipping...");
      return;
    }

    Keyboard.dismiss();

    resetVerificationState();
    resetFormState();
    setMobileNumber("");
    setCurrentStep("password");
    setIsManualEntry(false);
    setNeedsSimFetch(true);
    simFetchInProgressRef.current = true;

    try {
      const simCards = await fetchSimCards();

      setNeedsSimFetch(false);
      simFetchInProgressRef.current = false;
      setSimFetchAttempted(true);

      if (simCards.length === 0) {
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
        const number = simCards[0].phoneNumber;
        setAvailableSimCards(simCards);
        setMobileNumber(number);
        
        // Mark as pending and trigger verification after a delay
        pendingVerificationRef.current = number;
        setTimeout(() => {
          if (pendingVerificationRef.current === number) {
            pendingVerificationRef.current = null;
            verifyMobileNumber(number);
          }
        }, 500);
      } else {
        setAvailableSimCards(simCards);
        setShowSimPickerModal(true);
      }
    } catch (error) {
      setNeedsSimFetch(false);
      simFetchInProgressRef.current = false;
      setSimFetchAttempted(true);

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
    resetVerificationState();
    resetFormState();
    const number = simCard.phoneNumber;
    setMobileNumber(number);
    setShowSimPickerModal(false);
    setIsManualEntry(false);

    // Mark as pending and trigger verification after a delay
    pendingVerificationRef.current = number;
    setTimeout(() => {
      if (pendingVerificationRef.current === number) {
        pendingVerificationRef.current = null;
        verifyMobileNumber(number);
      }
    }, 500);
  };

  // ==================== MOBILE NUMBER CHANGE HANDLER ====================

  const handleMobileNumberChange = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^0-9]/g, "");
      setMobileNumber(cleaned);

      if (cleaned.length < 10 || lastCheckedNumberRef.current !== cleaned) {
        resetVerificationState();
      }
    },
    [resetVerificationState]
  );

  // ==================== MOBILE VERIFICATION ====================

  const verifyMobileNumber = useCallback(async (number: string) => {
    const cleanedNumber = number.replace(/[^0-9]/g, "");

    if (cleanedNumber.length < 10) {
      console.log("Number too short, skipping verification");
      return;
    }

    if (lastCheckedNumberRef.current === cleanedNumber) {
      console.log("Number already verified, skipping");
      return;
    }

    if (verificationInProgressRef.current) {
      console.log("Verification already in progress, skipping");
      return;
    }

    if (!apiUrlReady) {
      console.log("API not ready, will retry...");
      pendingVerificationRef.current = cleanedNumber;
      return;
    }

    try {
      verificationInProgressRef.current = true;
      setIsCheckingMobile(true);
      setMobileCheckMessage("");

      console.log("Starting verification for:", cleanedNumber);

      const response = await checkMobileExists(cleanedNumber);
      console.log("Verification response:", response);

      setHasMobileCheckResult(true);
      lastCheckedNumberRef.current = cleanedNumber;
      pendingVerificationRef.current = null;

      if (!response.exists) {
        setIsMobileAllowed(false);
        const message = `Mobile number ${cleanedNumber} is not registered. Please contact your administrator.`;
        setMobileCheckMessage(message);
        setCurrentStep("password");
        return;
      }

      if (response.canlogin !== 1) {
        setIsMobileAllowed(false);
        const message =
          "Login not allowed. Please contact your administrator.";
        setMobileCheckMessage(message);
        setCurrentStep("password");
        return;
      }

      setIsMobileAllowed(true);
      setMobileCheckMessage("");
      setCurrentStep(response.isPasswordSet ? "password" : "setPassword");
    } catch (error: any) {
      console.error("Check mobile error:", error);
      setIsMobileAllowed(false);
      setHasMobileCheckResult(true);
      pendingVerificationRef.current = null;
      const message =
        error.message || "Unable to verify mobile number. Please try again.";
      setMobileCheckMessage(message);
    } finally {
      setIsCheckingMobile(false);
      verificationInProgressRef.current = false;
    }
  }, [apiUrlReady]);

  // Auto-verify when mobile number reaches 10 digits (for manual entry / debug)
  useEffect(() => {
    if (!mobileNumber || mobileNumber.length < 10) return;
    if (!apiUrlReady) {
      console.log("API not ready, marking for pending verification");
      pendingVerificationRef.current = mobileNumber;
      return;
    }
    if (lastCheckedNumberRef.current === mobileNumber) return;
    if (verificationInProgressRef.current) return;

    // Debounce verification
    const timer = setTimeout(() => {
      verifyMobileNumber(mobileNumber);
    }, 300);

    return () => clearTimeout(timer);
  }, [mobileNumber, verifyMobileNumber, apiUrlReady]);

  // Retry pending verification when API becomes ready
  useEffect(() => {
    if (apiUrlReady && pendingVerificationRef.current && !verificationInProgressRef.current) {
      console.log("API ready, triggering pending verification");
      const numberToVerify = pendingVerificationRef.current;
      pendingVerificationRef.current = null;
      setTimeout(() => {
        verifyMobileNumber(numberToVerify);
      }, 300);
    }
  }, [apiUrlReady, verifyMobileNumber]);

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
    setTouched((prev) => ({ ...prev, mobile: true, password: true }));

    const cleanedNumber = mobileNumber.replace(/[^0-9]/g, "");
    if (cleanedNumber.length < 10) {
      Alert.alert("Error", "Please enter a valid 10-digit mobile number");
      return;
    }

    if (!isMobileAllowed) {
      if (!hasMobileCheckResult && !verificationInProgressRef.current) {
        await verifyMobileNumber(cleanedNumber);
      }
      return;
    }

    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    try {
      setIsLoading(true);

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

  // ==================== HEADER CONFIG ====================

  const getHeaderConfig = () => {
    switch (currentStep) {
      case "password":
        return {
          title: "Welcome",
          subtitle: isCheckingMobile
            ? "Verifying your mobile number..."
            : isFetchingSim
              ? "Fetching your mobile number..."
              : hasMobileCheckResult
                ? isMobileAllowed
                  ? "Enter your password to sign in"
                  : ""
                : IS_DEBUG
                  ? "Enter your mobile number and password"
                  : mobileNumber
                    ? "Verifying..."
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

  const isFormDisabled = () => {
    if (IS_DEBUG) {
      return isCheckingMobile || (hasMobileCheckResult && !isMobileAllowed);
    }
    return !isMobileAllowed || isCheckingMobile || isFetchingSim;
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

  // ==================== RENDER MOBILE INPUT SECTION ====================

  const renderMobileInputSection = () => (
    <>
      <CustomInput
        label=""
        placeholder="Enter 10-digit mobile number"
        value={mobileNumber}
        onChangeText={handleMobileNumberChange}
        editable={IS_DEBUG || isManualEntry}
        keyboardType="phone-pad"
        maxLength={10}
        autoFocus={IS_DEBUG && !mobileNumber}
        leftIcon={
          <Ionicons name="call-outline" size={20} color="#6B7280" />
        }
        rightIcon={
          <View className="flex-row items-center">
            {IS_DEBUG && (
              <View className="bg-amber-100 border border-amber-300 rounded-md px-2 py-0.5 mr-2">
                <Text className="text-amber-700 text-[10px] font-JakartaBold">
                  DEBUG
                </Text>
              </View>
            )}
            {mobileNumber.length === 10 &&
              !hasMobileCheckResult &&
              !isCheckingMobile && (
                <Pressable
                  onPress={() => verifyMobileNumber(mobileNumber)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  className="p-2 rounded-lg bg-blue-100"
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#3B82F6"
                  />
                </Pressable>
              )}
            {isCheckingMobile && (
              <View className="p-2">
                <ActivityIndicator size="small" color="#3B82F6" />
              </View>
            )}
            {isMobileAllowed && hasMobileCheckResult && !isCheckingMobile && (
              <View className="p-2">
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              </View>
            )}
            {!isMobileAllowed && hasMobileCheckResult && !isCheckingMobile && (
              <View className="p-2">
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </View>
            )}
            {isFetchingSim && !mobileNumber && (
              <View className="p-2">
                <ActivityIndicator size="small" color="#3B82F6" />
              </View>
            )}
          </View>
        }
        error={
          touched.mobile && mobileNumber.length > 0 && mobileNumber.length < 10
            ? "Enter a valid 10-digit mobile number"
            : !mobileNumber && touched.mobile
              ? "Mobile number is required"
              : ""
        }
        touched={touched.mobile}
        onBlur={() => setTouched((prev) => ({ ...prev, mobile: true }))}
      />

      {IS_DEBUG &&
        !isCheckingMobile &&
        !hasMobileCheckResult &&
        mobileNumber.length < 10 && (
          <View className="flex-row items-center mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Ionicons
              name="bug-outline"
              size={16}
              color="#D97706"
              style={{ marginTop: 1 }}
            />
            <Text className="ml-2 text-xs text-amber-700 flex-1">
              Debug mode: Enter any registered mobile number to test login.
            </Text>
          </View>
        )}

      {isFetchingSim && !mobileNumber && (
        <View className="flex-row items-center mt-2">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text className="ml-2 text-xs text-blue-500">
            Fetching mobile number from SIM...
          </Text>
        </View>
      )}

      {isCheckingMobile && (
        <View className="flex-row items-center mt-2">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text className="ml-2 text-xs text-blue-500">
            Verifying {mobileNumber}...
          </Text>
        </View>
      )}

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
          editable={!isCheckingMobile && (IS_DEBUG || isMobileAllowed)}
          leftIcon={
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={isFormDisabled() ? "#D1D5DB" : "#6B7280"}
            />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isFormDisabled()}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={isFormDisabled() ? "#D1D5DB" : "#6B7280"}
              />
            </Pressable>
          }
          error={!password && touched.password ? "Password is required" : ""}
          touched={touched.password}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
        />
        <Pressable
          onPress={handleGoToSetPassword}
          disabled={!isMobileAllowed || isCheckingMobile}
          className="mt-2"
        >
          <Text
            className={`text-right text-sm font-JakartaMedium ${
              !isMobileAllowed || isCheckingMobile
                ? "text-gray-400"
                : "text-blue-500"
            }`}
          >
            Forgot password?
          </Text>
        </Pressable>
      </View>

      <CustomButton
        title={
          isFetchingSim
            ? "Fetching Mobile Number..."
            : mobileNumber.length < 10
              ? "Enter Mobile Number"
              : !hasMobileCheckResult
                ? "Verify & Sign In"
                : "Sign In"
        }
        onPress={handleLogin}
        loading={isLoading}
        disabled={isLoading || isCheckingMobile || isFetchingSim}
        IconRight={() => (
          <Ionicons name="arrow-forward" size={20} color="white" />
        )}
      />
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
          editable={isMobileAllowed && !isCheckingMobile}
          leftIcon={
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={
                !isMobileAllowed || isCheckingMobile ? "#D1D5DB" : "#6B7280"
              }
            />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={!isMobileAllowed || isCheckingMobile}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={
                  !isMobileAllowed || isCheckingMobile ? "#D1D5DB" : "#6B7280"
                }
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
          editable={isMobileAllowed && !isCheckingMobile}
          leftIcon={
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={
                !isMobileAllowed || isCheckingMobile ? "#D1D5DB" : "#6B7280"
              }
            />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={!isMobileAllowed || isCheckingMobile}
            >
              <Ionicons
                name={
                  showConfirmPassword ? "eye-outline" : "eye-off-outline"
                }
                size={20}
                color={
                  !isMobileAllowed || isCheckingMobile ? "#D1D5DB" : "#6B7280"
                }
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

      <CustomButton
        title="Save Password"
        onPress={handleSetPassword}
        loading={isSettingPassword}
        disabled={isSettingPassword || !isMobileAllowed || isCheckingMobile}
        bgVariant="primary"
      />
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
          onPress={() => Keyboard.dismiss()}
          className="flex-1 bg-white justify-start"
        >
          <View className="flex-1 px-[10%] pt-8">
            {IS_DEBUG && (
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
                <Ionicons name={headerConfig.icon} size={40} color="white" />
              </View>
              <Text className="text-2xl font-JakartaBold text-gray-800 mb-2">
                {headerConfig.title}
              </Text>
              {headerConfig.subtitle && (
                <Text className="text-sm text-gray-500 text-center px-4">
                  {headerConfig.subtitle}
                </Text>
              )}
            </View>

            <Animated.View style={{ opacity: fadeAnim }}>
              {renderCurrentStep()}
            </Animated.View>
          </View>
        </Pressable>
      </ScrollView>

      {!IS_DEBUG && (
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
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}