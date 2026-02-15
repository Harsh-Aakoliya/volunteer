// app/index.tsx
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';
import * as Application from 'expo-application';
import { VersionChecker } from '@/components/VersionChecker';
import * as Notifications from 'expo-notifications';

import { Platform, Alert, TextInput, View, Text, Pressable } from 'react-native';
import CustomInput from '@/components/ui/CustomInput';
import CustomButton from '@/components/ui/CustomButton';
import { API_URL, setApiUrl, updateDevIP } from "@/constants/api";
import useNetworkStatus from '@/hooks/userNetworkStatus';
import SplashScreen from '@/components/SplashScreen';
import * as React from 'react';

const DEV_IP = "http://10.27.61.242:8080";
const EXTERNAL_IP = "http://103.47.172.58:50160";
const INTERNAL_IP = "http://192.168.2.134:3000";

export const getDevModeStatus = () => true;
export const getDefaultDevIP = () => DEV_IP;

const isWeb = Platform.OS === ('web' as any);

export default function Index() {
  const appVersion = Application.nativeApplicationVersion;
  const router = useRouter();
  const isConnected = useNetworkStatus() || isWeb;
  console.log("isConnected", isConnected);
  const [connectivityCheckComplete, setConnectivityCheckComplete] = useState(false);
  const [versionCheckComplete, setVersionCheckComplete] = useState(false);
  const [showDevIpInput, setShowDevIpInput] = useState(false);
  const [devIpInput, setDevIpInput] = useState('');
  const [hasNavigated, setHasNavigated] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showIPModal, setShowIPModal] = useState(false);
  const [devIP, setDevIP] = useState(getDefaultDevIP());

  useEffect(() => {
    const isDevMode = getDevModeStatus();

    const pingServer = async (baseUrl: string, from: string, timeoutMs: number = 5000): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(`${baseUrl}/api/test?from=${from}&ip=${baseUrl}`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await res.json();
        return data.message === "API is running";
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error(`⏰ ${from.toUpperCase()} check timed out after ${timeoutMs}ms`);
        } else {
          console.error(`❌ ${from.toUpperCase()} check failed:`, err.message || err);
        }
        return false;
      }
    };

    const checkInternet = async (): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch("https://clients3.google.com/generate_204", {
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.status === 204;
      } catch (err: any) {
        console.error("Internet check failed:", err.message || err);
        return false;
      }
    };

    const setupApiUrl = async () => {
      if (isWeb) {
        setApiUrl("http://localhost:8080" as any);
        console.log("API_URL", API_URL);
        setConnectivityCheckComplete(true);
        return;
      }
      console.log("🔍 Starting server connectivity check...");

      console.log("isConnected:", isConnected);
      if (!isConnected) {
        console.log("❌ No internet connection available");
        Alert.alert(
          "No Internet Connection",
          "Please connect to the internet via WiFi or mobile data and try again."
        );
        return;
      }

      console.log("isDevMode:", isDevMode);
      if (isDevMode) {
        console.log("⚙️ Dev mode - prompting for manual IP");
        setApiUrl(DEV_IP);
        setConnectivityCheckComplete(true);
        return;
      }

      console.log("🏠 Checking internal network connection...");
      setApiUrl(INTERNAL_IP);
      const internalOk = await pingServer(INTERNAL_IP, "internal");
      console.log("Internal network result:", internalOk);

      if (internalOk) {
        console.log("✅ Connected via Internal IP");
        setApiUrl(INTERNAL_IP);
        setConnectivityCheckComplete(true);
        return;
      }

      console.log("🌐 Checking external network connection...");
      setApiUrl(EXTERNAL_IP);
      const externalOk = await pingServer(EXTERNAL_IP, "external");
      console.log("External network result:", externalOk);

      if (externalOk) {
        console.log("✅ Connected via External IP");
        setApiUrl(EXTERNAL_IP);
        setConnectivityCheckComplete(true);
        return;
      }

      console.log("❌ Both internal and external connections failed. Checking internet...");
      const hasInternet = await checkInternet();

      if (!hasInternet) {
        Alert.alert(
          "No Internet Connection",
          "Please connect to the internet via WiFi or mobile data and try again."
        );
      } else {
        Alert.alert(
          "Server Unreachable",
          "Server is not reachable. Please contact admin or try again later."
        );
      }

      return;
    };

    setupApiUrl();
  }, [isConnected]);

  const handleDevIpSubmit = async () => {
    if (!devIpInput.trim()) {
      Alert.alert("Invalid IP", "Please enter a valid IP address with port");
      return;
    }

    if (!isConnected) {
      Alert.alert("No Internet Connection", "Please check your internet connection and try again.");
      return;
    }

    console.log("⚙️ Testing dev IP:", devIpInput);
    setApiUrl(devIpInput);

    const pingServer = async (baseUrl: string, from: string, timeoutMs: number = 5000): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(`${baseUrl}/api/test?from=${from}&ip=${baseUrl}`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await res.json();
        return data.message === "API is running";
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error(`⏰ ${from.toUpperCase()} check timed out after ${timeoutMs}ms`);
        } else {
          console.error(`❌ ${from.toUpperCase()} check failed:`, err.message || err);
        }
        return false;
      }
    };

    const reachable = await pingServer(devIpInput, "dev");
    if (reachable) {
      console.log("✅ Dev server connected successfully");
      setShowDevIpInput(false);
      setConnectivityCheckComplete(true);
    } else {
      Alert.alert("Dev Server Unreachable", "Could not reach your development server. Please check the IP address and try again.");
    }
  };

  useEffect(() => {
    if (!connectivityCheckComplete) return;

    if (Platform.OS === "web") {
      console.log("🌐 Web platform detected, skipping version check");
      setVersionCheckComplete(true);
    } else {
      console.log("🔄 Connectivity established, starting version check...");
      setVersionCheckComplete(false);
    }
  }, [connectivityCheckComplete]);

  const checkAuthStatus = useCallback(async () => {
    try {
      setHasNavigated(true);
      const token = await AuthStorage.getToken();
      console.log("Token:", token);
      
      if (token) {
        try {
          const initialNotification = await Notifications.getLastNotificationResponseAsync();
          
          if (initialNotification?.notification?.request?.content?.data?.roomId) {
            const roomId = initialNotification.notification.request.content.data.roomId;
            console.log("📱 App opened from notification, navigating to room:", roomId);
            setTimeout(() => {
              router.replace(`/chat/${roomId}`);
            }, 500);
            return;
          }
        } catch (error) {
          console.log("Error checking initial notification:", error);
        }
        
        console.log("Redirecting to chat");
        router.replace("/(drawer)");
      } else {
        console.log("Redirecting to login");
        router.replace("/login");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!connectivityCheckComplete || !versionCheckComplete || hasNavigated) return;

    console.log("🔄 Both connectivity and version checks complete, checking auth status...");
    checkAuthStatus();
  }, [connectivityCheckComplete, versionCheckComplete, hasNavigated, checkAuthStatus]);

  // Handler for bottom-right corner taps
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

  if (showDevIpInput) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, marginBottom: 20, textAlign: 'center' }}>
          Development Mode
        </Text>
        <Text style={{ marginBottom: 10, textAlign: 'center' }}>
          Enter your development server IP address:
        </Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 10,
            marginBottom: 20,
            width: '100%',
            borderRadius: 5
          }}
          placeholder="e.g., x.x.x.x:3000"
          value={devIpInput}
          onChangeText={setDevIpInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Text
            style={{
              backgroundColor: '#007AFF',
              color: 'white',
              padding: 10,
              borderRadius: 5,
              textAlign: 'center',
              minWidth: 80
            }}
            onPress={handleDevIpSubmit}
          >
            Connect
          </Text>
          <Text
            style={{
              backgroundColor: '#FF3B30',
              color: 'white',
              padding: 10,
              borderRadius: 5,
              textAlign: 'center',
              minWidth: 80
            }}
            onPress={() => setShowDevIpInput(false)}
          >
            Cancel
          </Text>
        </View>
      </View>
    );
  }

  const showSplash = !connectivityCheckComplete || !versionCheckComplete;
  if (showSplash) {
    return (
      <View style={{ flex: 1 }}>
        <SplashScreen />
        
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

{connectivityCheckComplete && (Platform.OS === 'ios' || Platform.OS === 'android') && (
        <VersionChecker onUpdateCheckComplete={(updateRequired) => {
          if (!updateRequired) setVersionCheckComplete(true);
        }} />
      )}
        
        {/* IP Modal */}
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

                    if (!isConnected) {
                      Alert.alert("No Internet Connection", "Please check your internet connection and try again.");
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
                    setClickCount(0);
                  }}
                  bgVariant="success"
                  className="flex-1"
                />
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  return <SplashScreen />;
}