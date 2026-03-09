// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Alert, AppState } from "react-native";

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
import useNetworkStatus from "@/hooks/userNetworkStatus";
import { setupApiUrl } from "@/utils/setupApiUrl";
import { VersionChecker } from "@/components/VersionChecker";

const isWeb = Platform.OS === ("web" as any);

function AppContent() {
  const isConnected = useNetworkStatus() || isWeb;
  const [isReady, setIsReady] = useState(true);

  // Bootstrap: notifications etc.
  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(true);
      return;
    }
    const bootstrap = async () => {
      try {
        await initializeNotifications();
        await requestChatNotificationPermissions();
        setupChatNotificationListeners();
        await clearAllNotifications();
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
      if (nextState === "active") clearAllNotifications();
    });
    return () => subscription.remove();
  }, []);

  // Background: set API URL when ready. Does not block navigation (index decides route from token).
  useEffect(() => {
    if (!isReady) return;
    const t = setTimeout(() => {
      setupApiUrl(isConnected);
    }, 300);
    return () => clearTimeout(t);
  }, [isReady, isConnected]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          statusBarStyle: "dark",
          statusBarBackgroundColor: "#F5F5F5",
        }}
      />
      {isReady &&
        (Platform.OS === "ios" || Platform.OS === "android") && (
          <VersionChecker onUpdateCheckComplete={() => {}} />
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
