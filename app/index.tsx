// app/index.tsx
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';
import * as Application from 'expo-application';
import { VersionChecker } from '@/components/VersionChecker';
import { Platform, Alert, TextInput, View, Text } from 'react-native';
import { setApiUrl } from '@/constants/api';
import React from 'react';

const DEV_IP = "http://192.168.64.33:3000";
const INTERNAL_IP = "http://192.168.2.134:3000";
const EXTERNAL_IP = "http://103.47.172.58:50160";

export default function Index() {
  const appVersion = Application.nativeApplicationVersion;
  const router = useRouter();
  const [connectivityCheckComplete, setConnectivityCheckComplete] = useState(false);
  const [versionCheckComplete, setVersionCheckComplete] = useState(false);
  const [showDevIpInput, setShowDevIpInput] = useState(false);
  const [devIpInput, setDevIpInput] = useState('');
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    const isDevMode = true; // Set to true to enable manual IP configuration for development

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
      console.log("🔍 Starting server connectivity check...");

      // Step 1: Check if user is in dev mode
      console.log("isDevMode:", isDevMode);
      if (isDevMode) {
        console.log("⚙️ Dev mode - prompting for manual IP");
        // setShowDevIpInput(true);
        setApiUrl(DEV_IP);
        setConnectivityCheckComplete(true);
        return;
      }

      // Step 2: Try internal network first
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

      // Step 3: Try external network
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

      // Step 4: Both internal and external failed - check internet connectivity
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
  }, []);

  const handleDevIpSubmit = async () => {
    if (!devIpInput.trim()) {
      Alert.alert("Invalid IP", "Please enter a valid IP address with port (e.g., http://192.168.1.100:3000)");
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

  // Step 2: Start version check only after connectivity is established (skip for web)
  useEffect(() => {
    if (!connectivityCheckComplete) return;
    
    if (Platform.OS === "web") {
      console.log("🌐 Web platform detected, skipping version check");
      setVersionCheckComplete(true);
    } else {
      console.log("🔄 Connectivity established, starting version check...");
      // This will trigger the VersionChecker component to run
      setVersionCheckComplete(false); // Reset in case it was set before
    }
  }, [connectivityCheckComplete]);

  // Step 3: Define auth check function with useCallback at top level
  const checkAuthStatus = useCallback(async () => {
    try {
      setHasNavigated(true); // Prevent multiple navigation attempts
      const token = await AuthStorage.getToken();
      console.log("Token:", token);
      if (token) {
        console.log("Redirecting to announcement");
        router.replace("/announcement");
      } else {
        console.log("Redirecting to login");
        router.replace("/login");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      router.replace("/login");
    }
  }, [router]);

  // Step 4: Navigate to appropriate screen only after both connectivity and version checks are complete
  useEffect(() => {
    if (!connectivityCheckComplete || !versionCheckComplete || hasNavigated) return;

    console.log("🔄 Both connectivity and version checks complete, checking auth status...");
    checkAuthStatus();
  }, [connectivityCheckComplete, versionCheckComplete, hasNavigated, checkAuthStatus]);

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
          placeholder="http://192.168.1.100:3000"
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

  // Show loading state while connectivity check is in progress
  if (!connectivityCheckComplete) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, textAlign: 'center' }}>
          Connecting to server...
        </Text>
      </View>
    );
  }



  return (
    <>
      {(Platform.OS === "ios" || Platform.OS === "android") && (
        <VersionChecker onUpdateCheckComplete={() => setVersionCheckComplete(true)} />
      )}
    </>
  );
}




