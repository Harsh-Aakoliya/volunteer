// import { Redirect } from 'expo-router';

// export default function Index() {
//   return <Redirect href="/(auth)/login" />;
// }


// app/index.tsx
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';
import * as Application from 'expo-application';
import { VersionChecker } from '@/components/VersionChecker';
import { Platform, Alert, TextInput, View, Text, TouchableOpacity } from 'react-native';
import CustomInput from '@/components/ui/CustomInput';
import CustomButton from '@/components/ui/CustomButton';
import { API_URL, setApiUrl, updateDevIP } from "@/constants/api";
import useNetworkStatus from '@/hooks/userNetworkStatus';
import * as React from 'react';
const DEV_IP = "http://10.152.91.242:8080";
const INTERNAL_IP = "http://192.168.2.134:3000";
const EXTERNAL_IP = "http://103.47.172.58:50160";

// Export dev mode status and DEV_IP for use in other components
export const getDevModeStatus = () => true; // Set to true to enable manual IP configuration for development
export const getDefaultDevIP = () => DEV_IP;

export default function Index() {
  const appVersion = Application.nativeApplicationVersion;
  const router = useRouter();
  const isConnected = useNetworkStatus();
  const [connectivityCheckComplete, setConnectivityCheckComplete] = useState(false);
  const [versionCheckComplete, setVersionCheckComplete] = useState(false);
  const [showDevIpInput, setShowDevIpInput] = useState(false);
  const [devIpInput, setDevIpInput] = useState('');
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    const isDevMode = getDevModeStatus(); // Use exported function for consistency

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

      // Step 0: Check internet connectivity first
      if (!isConnected) {
        console.log("❌ No internet connection available");
        Alert.alert(
          "No Internet Connection", 
          "Please connect to the internet via WiFi or mobile data and try again."
        );
        return;
      }

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
  }, [isConnected]);

  const handleDevIpSubmit = async () => {
    if (!devIpInput.trim()) {
      Alert.alert("Invalid IP", "Please enter a valid IP address with port (e.g., http://192.168.1.100:3000)");
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
        console.log("Redirecting to chat");
        // Online status is handled by _layout.tsx via useOnlineStatus hook
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

  // Step 4: Navigate to appropriate screen only after both connectivity and version checks are complete
  useEffect(() => {
    if (!connectivityCheckComplete || !versionCheckComplete || hasNavigated) return;

    console.log("🔄 Both connectivity and version checks complete, checking auth status...");
    checkAuthStatus();
  }, [connectivityCheckComplete, versionCheckComplete, hasNavigated, checkAuthStatus]);
  const [showIPModal, setShowIPModal] = useState(false);
  const [clickCount, setClickCount] = useState(0); // New state for click tracking
  const [devIP, setDevIP] = useState(getDefaultDevIP()); // Initialize with default dev IP

  const handleLoginToContinuePress = () => {
    setClickCount((prevCount) => {
      const newCount = prevCount + 1;
      console.log("newCount", newCount);
  
      if (newCount >= 7) {
        Alert.alert(
          "🔧 Developer Mode Activated",
          "You will now be redirected to login screen to set backend IP.",
          [
            {
              text: "OK",
              onPress: () => {
                // Navigate to login WITH state to trigger IP modal
                router.replace({
                  pathname: '/login',
                  params: { showDevIpModal: 'true' },
                });
                setClickCount(0); // Reset counter
              },
            },
          ]
        );
        return 0; // Reset immediately even if alert dismissed without OK
      }
  
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
      <View className="flex-1 justify-center items-center bg-gray-100">
        <TouchableOpacity onPress={handleLoginToContinuePress} className="bg-blue-500 p-4 rounded-lg">
          <Text className="text-white text-lg font-bold">
            Connecting to server...
          </Text>
        </TouchableOpacity>
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
            setClickCount(0); // Fully reset counter
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



  return (
    <>
      {(Platform.OS === "ios" || Platform.OS === "android") && (
        <VersionChecker onUpdateCheckComplete={() => setVersionCheckComplete(true)} />
      )}
    </>
  );
}