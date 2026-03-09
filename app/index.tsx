// Entry: decide route from token only; redirect to drawer (rooms) or login. No wait for API/socket.
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { AuthStorage } from "@/utils/authStorage";

export default function Index() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (done.current) return;
      const run = async () => {
        const token = await AuthStorage.getToken();
        if (!token) {
          done.current = true;
          router.replace("/login");
          return;
        }
        try {
          const initialNotification =
            await Notifications.getLastNotificationResponseAsync();
          const roomId =
            initialNotification?.notification?.request?.content?.data?.roomId;
          if (roomId) {
            done.current = true;
            router.replace(`/chat/${roomId}`);
            return;
          }
        } catch (_) {}
        done.current = true;
        router.replace("/(drawer)");
      };
      run();
    }, 50);
    return () => clearTimeout(id);
  }, [router]);

  return null;
}
