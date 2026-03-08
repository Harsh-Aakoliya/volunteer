// app/index.tsx
// Entry: show drawer (rooms from local storage) once layout is mounted. Background checks run in _layout.
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Defer navigation until Root Layout has mounted its navigator (avoids "navigate before mount" error)
    const id = setTimeout(() => {
      router.replace("/(drawer)");
    }, 50);
    return () => clearTimeout(id);
  }, [router]);

  return null;
}
