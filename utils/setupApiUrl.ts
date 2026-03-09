// Shared connectivity / API URL setup for app entry and _layout
import { Platform, Alert } from "react-native";
import { setApiUrl } from "@/constants/api";



export const getDevModeStatus = () => true;
export const getDefaultDevIP = () => DEV_IP;

const isWeb = Platform.OS === ("web" as any);

export async function pingServer(
  baseUrl: string,
  from: string,
  timeoutMs: number = 5000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/api/test?from=${from}&ip=${baseUrl}`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data.message === "API is running";
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error(`⏰ ${from.toUpperCase()} check timed out after ${timeoutMs}ms`);
    } else {
      console.error(`❌ ${from.toUpperCase()} check failed:`, err.message || err);
    }
    return false;
  }
}

export async function checkInternet(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch("https://clients3.google.com/generate_204", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.status === 204;
  } catch (err: any) {
    console.error("Internet check failed:", err.message || err);
    return false;
  }
}

/**
 * Run API URL setup in background (internal/external/dev). Call from _layout.
 */
export async function setupApiUrl(isConnected: boolean): Promise<void> {
  if (isWeb) {
    setApiUrl("http://localhost:8080" as any);
    return;
  }
  console.log("🔍 [Background] Server connectivity check...");
  // If the hook says \"offline\", double-check with a real internet ping before alerting.
  if (!isConnected) {
    const hasInternet = await checkInternet();
    if (!hasInternet) {
      console.log("❌ No internet connection available (verified)");
      Alert.alert(
        "No Internet Connection",
        "Please connect to the internet via WiFi or mobile data and try again."
      );
      return;
    }
    console.log("✅ Hook reported offline but internet ping succeeded; continuing setup.");
  }
  const isDevMode = getDevModeStatus();
  if (isDevMode) {
    console.log("⚙️ Dev mode - using default dev IP");
    setApiUrl(DEV_IP);
    return;
  }
  console.log("🏠 [Background] Checking internal network...");
  setApiUrl(INTERNAL_IP);
  const internalOk = await pingServer(INTERNAL_IP, "internal");
  if (internalOk) {
    console.log("✅ Connected via Internal IP");
    setApiUrl(INTERNAL_IP);
    return;
  }
  console.log("🌐 [Background] Checking external network...");
  setApiUrl(EXTERNAL_IP);
  const externalOk = await pingServer(EXTERNAL_IP, "external");
  if (externalOk) {
    console.log("✅ Connected via External IP");
    setApiUrl(EXTERNAL_IP);
    return;
  }
  console.log("❌ Both internal and external failed. Checking internet...");
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
}
