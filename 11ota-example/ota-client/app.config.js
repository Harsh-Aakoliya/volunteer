// app.config.js

const OTA_SERVER_URL = "http://10.112.176.242:3000";  // ← Your server IP
const APP_KEY = "28b9e73e718da17240a1";                // ← From ota-cli app:create
const DEPLOYMENT = "production";                       // ← or "staging"

export default {
  name: "react-native-ota-client",
  slug: "react-native-ota-client",
  version: "1.0.0",
  
  // ★★★ This is the critical runtimeVersion ★★★
  // It MUST match what you pass to the CLI with --runtime
  runtimeVersion: "1.0.0",
  
  orientation: "portrait",

  // ═══════════════════════════════════════
  // ★ OTA UPDATE CONFIGURATION ★
  // ═══════════════════════════════════════
  updates: {
    // Point to YOUR custom OTA server manifest endpoint
    url: `${OTA_SERVER_URL}/api/expo/manifest?app_key=${APP_KEY}&deployment=${DEPLOYMENT}`,
    
    enabled: true,
    
    // Check for updates on app launch
    checkAutomatically: "ON_LOAD",
    
    // Timeout for the update check before falling back to cached bundle
    fallbackToCacheTimeout: 5000,
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.harsh123890.reactnativeotaclient",
  },
  android: {
    package: "com.harsh123890.reactnativeotaclient",
  },

  // Required for expo-updates
  extra: {
    eas: {
        projectId: "75d4ee71-63c1-4971-afa0-6b2a7c23188e"
      },
    otaServerUrl: OTA_SERVER_URL,
    otaAppKey: APP_KEY,
    otaDeployment: DEPLOYMENT,
  },

  plugins: ["expo-updates"],
};