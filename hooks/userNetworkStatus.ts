// useNetworkStatus.js
import { useEffect, useState } from "react";
import { Platform } from "react-native";
export default function useNetworkStatus(intervalMs = 3000) {

  if(Platform.OS === "web") {
    return true;
  }
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkConnection = async () => {
      try {
        // Try to ping a fast, reliable endpoint
        const response = await fetch("https://www.google.com", { method: "HEAD" });
        if (isMounted) setIsConnected(response.ok);
      } catch (error) {
        if (isMounted) setIsConnected(false);
      }
    };

    // Initial check
    checkConnection();

    // Check every few seconds
    const interval = setInterval(checkConnection, intervalMs);

    return () => {
      isMounted = false;  
      clearInterval(interval);
    };
  }, [intervalMs]);

  return isConnected;
}