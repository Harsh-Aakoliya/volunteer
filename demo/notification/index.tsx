import React, { useEffect, useState } from "react";
import { View, Button, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import axios from "axios";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [expoToken, setExpoToken] = useState("");
  const [fcmToken, setFcmToken] = useState("");

  useEffect(() => {
    registerForPush();
  }, []);

  async function registerForPush() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    // Expo push token
    const expoPushToken = (
      await Notifications.getExpoPushTokenAsync({
        projectId: Constants?.expoConfig?.extra?.eas?.projectId,
      })
    ).data;
    setExpoToken(expoPushToken);
    console.log("Expo token:", expoPushToken);

    // FCM token
    const { data: rawFcm } = await Notifications.getDevicePushTokenAsync();
    setFcmToken(rawFcm);
    console.log("FCM token:", rawFcm);
  }

  const storeToken = async () => {
    await axios.post("http://192.168.64.33:3000/store-token", {
      expoToken,
      fcmToken,
    });
    Alert.alert("Tokens stored successfully");
  };

  const deleteToken = async () => {
    await axios.post("http://192.168.64.33:3000/delete-token", {
      expoToken,
      fcmToken,
    });
    Alert.alert("Tokens deleted successfully");
  };

  const sendExpo = async () => {
    await axios.post("http://192.168.64.33:3000/trigger-expo");
    Alert.alert("Expo push request sent to all tokens");
  };

  const sendFcm = async () => {
    await axios.post("http://192.168.64.33:3000/trigger-fcm");
    Alert.alert("FCM push request sent to all tokens");
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button title="Store Token" onPress={storeToken} />
      <Button title="Delete Token" onPress={deleteToken} />
      <Button title="Send Expo Push (All)" onPress={sendExpo} />
      <Button title="Send FCM Push (All)" onPress={sendFcm} />
    </View>
  );
}
