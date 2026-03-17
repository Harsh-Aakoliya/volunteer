// import React, { useEffect, useState } from "react";
// import {
//   SafeAreaView,
//   Text,
//   View,
//   StyleSheet,
//   FlatList,
// } from "react-native";
// import NetInfo from "@react-native-community/netinfo";
// import publicIP from "react-native-public-ip";

// interface IpEntry {
//   ip: string;
//   timestamp: string;
//   id: string;
//   status: "online" | "offline";
// }

// const App: React.FC = () => {
//   const [ipList, setIpList] = useState<IpEntry[]>([]);

//   const addEntry = (ip: string, status: "online" | "offline") => {
//     const entry: IpEntry = {
//       ip,
//       timestamp: new Date().toLocaleString(),
//       id: Date.now().toString(),
//       status,
//     };
//     setIpList((prev) => [entry, ...prev]);
//   };

//   const fetchAndAddIP = async () => {
//     try {
//       const ip = await publicIP();
//       addEntry(ip, "online");
//     } catch (error) {
//       addEntry("No Internet", "offline");
//     }
//   };

//   useEffect(() => {
//     const unsubscribe = NetInfo.addEventListener((state) => {
//       if (state.isConnected && state.isInternetReachable) {
//         fetchAndAddIP();
//       } else {
//         addEntry("No Internet", "offline");
//       }
//     });

//     return () => unsubscribe();
//   }, []);

//   return (
//     <SafeAreaView style={styles.container}>
//       <Text style={styles.title}>IP Log</Text>
//       <FlatList
//         data={ipList}
//         keyExtractor={(item) => item.id}
//         renderItem={({ item }) => (
//           <View style={[
//             styles.row,
//             { backgroundColor: item.status === "online" ? "#e6ffe6" : "#ffe6e6" }
//           ]}>
//             <Text style={styles.ip}>
//               {item.status === "online" ? "🟢" : "🔴"} {item.ip}
//             </Text>
//             <Text style={styles.time}>{item.timestamp}</Text>
//           </View>
//         )}
//       />
//     </SafeAreaView>
//   );
// };

// export default App;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 20,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: "bold",
//     marginBottom: 20,
//   },
//   row: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     paddingVertical: 10,
//     paddingHorizontal: 10,
//     borderRadius: 8,
//     marginBottom: 5,
//   },
//   ip: {
//     fontSize: 16,
//     fontWeight: "500",
//   },
//   time: {
//     fontSize: 14,
//     color: "#666",
//   },
// });


// import React, { useEffect, useState } from "react";
// import { SafeAreaView, Text } from "react-native";

// export default function App() {
//   const [ip, setIp] = useState("");

//   const getPublicIP = async () => {
//     try {
//       const res = await fetch("https://api.ipify.org?format=json");
//       const data = await res.json();
//       setIp(data.ip);
//     } catch (err) {
//       setIp("No Internet");
//     }
//   };

//   useEffect(() => {
//     getPublicIP();
//   }, []);

//   return (
//     <SafeAreaView>
//       <Text>Public IP: {ip}</Text>
//     </SafeAreaView>
//   );
// }

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