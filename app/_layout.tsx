// app/_layout.tsx
import { Stack, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { Platform, Alert, AppState, Pressable, View, Text } from "react-native";
import * as React from "react";

import "../global.css";
import { initializeNotifications } from "@/utils/notificationSetup";
import {
  requestChatNotificationPermissions,
  setupChatNotificationListeners,
  clearAllNotifications,
} from "@/utils/chatNotificationHandler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SocketProvider } from "@/contexts/SocketContext";
import { VideoCallProvider } from "@/contexts/VideoCallContext";
import SplashScreen from "@/components/SplashScreen";
import useNetworkStatus from "@/hooks/userNetworkStatus";
import { setupApiUrl, getDefaultDevIP, getDevModeStatus } from "@/utils/setupApiUrl";
import { updateDevIP } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import * as Notifications from "expo-notifications";
import { VersionChecker } from "@/components/VersionChecker";
import CustomInput from "@/components/ui/CustomInput";
import CustomButton from "@/components/ui/CustomButton";

const isWeb = Platform.OS === ("web" as any);

// Inner component that uses socket context
function AppContent() {
  const router = useRouter();
  const isConnected = useNetworkStatus() || isWeb;
  const [isReady, setIsReady] = useState(true);
  const [connectivityComplete, setConnectivityComplete] = useState(false);
  const [showIPModal, setShowIPModal] = useState(false);
  const [devIP, setDevIP] = useState(getDefaultDevIP());
  const [clickCount, setClickCount] = useState(0);
  const authCheckDone = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(true);
      return;
    }

    const bootstrap = async () => {
      try {
        if (Platform.OS !== "web") {
          await initializeNotifications();
          await requestChatNotificationPermissions();
          setupChatNotificationListeners();
          await clearAllNotifications();
        }
      } catch (error: any) {
        console.error("Bootstrap error:", error);
        if (Platform.OS !== "web") {
          Alert.alert(
            "Startup Error",
            error?.message || "Something went wrong during startup. Please try again."
          );
        }
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        clearAllNotifications();
      }
    });

    return () => subscription.remove();
  }, []);

  // Background: API URL setup (IP checking)
  useEffect(() => {
    if (!isReady) return;
    const t = setTimeout(() => {
      setupApiUrl(isConnected).then(() => setConnectivityComplete(true));
    }, 300);
    return () => clearTimeout(t);
  }, [isReady, isConnected]);

  // Background: auth check and redirect to login if no token; handle notification deep link
  useEffect(() => {
    if (!connectivityComplete || authCheckDone.current) return;

    const run = async () => {
      const token = await AuthStorage.getToken();
      if (!token) {
        authCheckDone.current = true;
        router.replace("/login");
        return;
      }
      try {
        const initialNotification = await Notifications.getLastNotificationResponseAsync();
        const roomId = initialNotification?.notification?.request?.content?.data?.roomId;
        if (roomId) {
          authCheckDone.current = true;
          router.replace(`/chat/${roomId}`);
          return;
        }
      } catch (_) {}
      authCheckDone.current = true;
    };

    run();
  }, [connectivityComplete, router]);

  // 7 taps on bottom-right to open IP modal (dev)
  const handleBottomRightPress = () => {
    if (!getDevModeStatus()) return;
    setClickCount((prev) => {
      const next = prev + 1;
      if (next >= 7) {
        setShowIPModal(true);
        return 0;
      }
      setTimeout(() => setClickCount(0), 2000);
      return next;
    });
  };

  if (!isReady) {
    // return <SplashScreen />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          statusBarStyle: "dark",
          statusBarBackgroundColor: "#F5F5F5",
        }}
      />
      {connectivityComplete && (Platform.OS === "ios" || Platform.OS === "android") && (
        <VersionChecker onUpdateCheckComplete={() => {}} />
      )}
      {getDevModeStatus() && (
        <Pressable
          onPress={handleBottomRightPress}
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            width: 80,
            height: 80,
            zIndex: 1,
          }}
        />
      )}
      {showIPModal && (
        <View className="absolute inset-0 bg-black/50 flex justify-center items-center z-50">
          <View className="bg-white p-6 rounded-xl w-11/12 max-w-md mx-4">
            <Text className="text-lg font-JakartaBold mb-4">Set Backend IP Address</Text>
            <CustomInput
              placeholder="e.g., 192.168.1.100:3000"
              value={devIP.replace(/^https?:\/\//, "")}
              onChangeText={(text) => setDevIP(text)}
              keyboardType="url"
            />
            <View className="flex-row justify-between mt-4 space-x-2">
              <CustomButton
                title="Cancel"
                onPress={() => {
                  setShowIPModal(false);
                  setClickCount(0);
                }}
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
                    Alert.alert(
                      "No Internet Connection",
                      "Please check your internet connection and try again."
                    );
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
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SocketProvider>
        <VideoCallProvider>
          <AppContent />
        </VideoCallProvider>
      </SocketProvider>
    </GestureHandlerRootView>
  );
}