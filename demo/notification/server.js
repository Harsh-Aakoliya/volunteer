import express from "express";
import cors from "cors";
import { Expo } from "expo-server-sdk";
import admin from "firebase-admin";
import fs from "fs";
import os from "os";

const app = express();
app.use(cors());
app.use(express.json());

// Load Firebase service account key
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf-8")
);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const expo = new Expo();

// In-memory token storage
let expoTokens = new Set();
let fcmTokens = new Set();

// Store token
app.post("/store-token", (req, res) => {
  const { expoToken, fcmToken } = req.body;
  if (expoToken) expoTokens.add(expoToken);
  if (fcmToken) fcmTokens.add(fcmToken);
  res.json({ success: true, expoTokens: [...expoTokens], fcmTokens: [...fcmTokens] });
});

// Delete token
app.post("/delete-token", (req, res) => {
  const { expoToken, fcmToken } = req.body;
  if (expoToken) expoTokens.delete(expoToken);
  if (fcmToken) fcmTokens.delete(fcmToken);
  res.json({ success: true, expoTokens: [...expoTokens], fcmTokens: [...fcmTokens] });
});

// Expo push route (send to all stored tokens)
app.post("/trigger-expo", async (req, res) => {
  if (expoTokens.size === 0) {
    return res.json({ success: false, error: "No Expo tokens stored" });
  }

  const messages = [...expoTokens].map((token) => ({
    to: token,
    sound: "default",
    title: "Expo Push",
    body: "Hello from Expo!",
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }

  res.json({ success: true, sentTo: [...expoTokens] });
});

// FCM push route (send to all stored tokens)
app.post("/trigger-fcm", async (req, res) => {
  if (fcmTokens.size === 0) {
    return res.json({ success: false, error: "No FCM tokens stored" });
  }

  const responses = [];
  for (const token of fcmTokens) {
    try {
      const message = {
        token,
        notification: { title: "FCM Push", body: "Hello from Firebase!" },
      };
      const response = await admin.messaging().send(message);
      responses.push({ token, response });
    } catch (err) {
      console.error("Error sending to", token, err.message);
    }
  }

  res.json({ success: true, responses });
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => !item.internal && item.family === "IPv4")
    .map((item) => item.address);
  console.log(`Server running at:`);
  addresses.forEach((a) => console.log(`http://${a}:${PORT}`));
});
