const APP_VERSION = "1.0.19";

// This must match your production server URL (the one in apiStore EXTERNAL_IP)

export default {
  expo: {
    name: "Sevak",
    slug: "Sevak",
    version: APP_VERSION,
    runtimeVersion: APP_VERSION,
    userInterfaceStyle: "automatic",
    icon: "./assets/images/sevakapplogo.png",
    newArchEnabled: true,
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/sevakapplogo.png",
    },
    host: "lan",
    updates: {
      url: `${OTA_SERVER_URL}/api/ota/manifest?apkVersion=${APP_VERSION}`,
      enabled: true,
      checkAutomatically: "ON_ERROR_RECOVERY",
      fallbackToCacheTimeout: 5000,
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: true,
            networkSecurityConfig: {
              cleartextTrafficPermitted: true,
            },
            abiFilters: ["armeabi-v7a", "arm64-v8a"],
          },
        },
      ],
      "expo-speech-recognition",
      "expo-updates",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: "639317e2-9068-48c8-b1c4-dde98444a0db",
      },
      otaServerUrl: OTA_SERVER_URL,
    },
    owner: "harsh123890",
    android: {
      package: "com.harsh123890.Sevak",
      googleServicesFile: "./google-services.json",
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE",
        "MANAGE_EXTERNAL_STORAGE",
        "REQUEST_INSTALL_PACKAGES",
        "POST_NOTIFICATIONS",
        "READ_PHONE_STATE",
        "READ_PHONE_NUMBERS",
        "CAMERA",
        "RECORD_AUDIO",
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/images/sevakapplogo.png",
        backgroundColor: "#FFFFFF",
      },
    },
    ios: {
      bundleIdentifier: "com.harsh123890.Sevak",
    },
  },
};
