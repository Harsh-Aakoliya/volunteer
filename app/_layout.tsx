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
import { resolveApiUrl } from "@/stores/apiStore";
import { VersionChecker } from "@/components/VersionChecker";

function AppContent() {
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(true);
      return;
    }
    const bootstrap = async () => {
      try {
        await resolveApiUrl();
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
