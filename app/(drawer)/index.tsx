// app/chat/index.tsx - Updated with offline-first approach
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation, usePathname } from "expo-router";
import { fetchChatRooms } from "@/api/chat";
import { AuthStorage } from "@/utils/authStorage";
import { ChatRoomStorage } from "@/utils/chatRoomsStorage"; // New import
import { ChatRoom } from "@/types/type";
import { useFocusEffect } from "@react-navigation/native";
import socketService from "@/utils/socketService";
import eventEmitter from "@/utils/eventEmitter";
import { getRelativeTimeIST, formatISTTime } from "@/utils/dateUtils";
import { LinearGradient } from "expo-linear-gradient";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { DrawerActions } from "@react-navigation/native";
import NoChatRoomComponenet from "@/components/chat/NoChatRoomComponenet";
interface LastMessageResponse {
  lastMessageByRoom: {
    [roomId: string]: LastMessageData;
  };
}

interface LastMessageData {
  createdAt: string;
  id: number;
  mediaFilesId: number | null;
  messageText: string;
  messageType: string;
  pollId: number | null;
  sender: {
    userId: string;
    userName: string;
  };
  tableId: number | null;
}

interface UnreadCountsEvent {
  unreadCounts: {
    [roomId: string]: number;
  };
}

interface RoomUpdateEvent {
  roomId: string;
  lastMessage: LastMessageData;
  unreadCount: number;
}

interface ExtendedChatRoom extends ChatRoom {
  unreadCount?: number;
  lastMessage?: LastMessageData;
  onlineCount?: number;
}

export default function ChatRooms() {
  const [chatRooms, setChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [filteredChatRooms, setFilteredChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); // New state for background sync indicator
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastMessages, setLastMessages] = useState<{ [key: string]: LastMessageData }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [appState, setAppState] = useState(AppState.currentState);
  const navigation = useNavigation();
  const { setUserOnline } = useOnlineStatus();
  const hasSetOnline = useRef(false);
  const isInitialLoad = useRef(true);

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredChatRooms(chatRooms);
    } else {
      const filtered = chatRooms.filter(room =>
        room.roomName?.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredChatRooms(filtered);
    }
  };

  // Sort rooms by most recent activity
  const sortRoomsByRecent = (rooms: ExtendedChatRoom[]) => {
    return [...rooms].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : a.createdOn
          ? new Date(a.createdOn).getTime()
          : 0;

      const bTime = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : b.createdOn
          ? new Date(b.createdOn).getTime()
          : 0;

      return bTime - aTime;
    });
  };

  // Update rooms with last messages and unread counts
  const updateRoomsWithData = (
    rooms: ExtendedChatRoom[],
    lastMessagesData: { [key: string]: LastMessageData },
    unreadCountsData: { [key: string]: number }
  ) => {
    return rooms.map(room => {
      const roomIdStr = room.roomId?.toString();
      if (roomIdStr) {
        return {
          ...room,
          lastMessage: lastMessagesData[roomIdStr] || room.lastMessage,
          unreadCount: unreadCountsData[roomIdStr] || 0
        };
      }
      return room;
    });
  };

  // Helper function to detect changes between cached and fresh data
  const detectChanges = useCallback((cachedRooms: ChatRoom[], freshRooms: ChatRoom[]): boolean => {
    // Different count means changes
    if (cachedRooms.length !== freshRooms.length) {
      console.log('🔍 Change detected: Room count changed', cachedRooms.length, '->', freshRooms.length);
      return true;
    }

    // Create a map for quick lookup
    const cachedMap = new Map(cachedRooms.map(room => [room.roomId?.toString(), room]));

    for (const freshRoom of freshRooms) {
      const roomIdStr = freshRoom.roomId?.toString();
      const cachedRoom = cachedMap.get(roomIdStr);

      if (!cachedRoom) {
        console.log('🔍 Change detected: New room found', freshRoom.roomName);
        return true;
      }

      // Compare relevant fields
      if (
        cachedRoom.roomName !== freshRoom.roomName ||
        cachedRoom.roomDescription !== freshRoom.roomDescription ||
        cachedRoom.isGroup !== freshRoom.isGroup ||
        cachedRoom.memberCount !== freshRoom.memberCount
      ) {
        console.log('🔍 Change detected: Room data changed for', freshRoom.roomName);
        return true;
      }
    }

    // Check if any room was removed
    const freshMap = new Map(freshRooms.map(room => [room.roomId?.toString(), room]));
    for (const cachedRoom of cachedRooms) {
      if (!freshMap.has(cachedRoom.roomId?.toString())) {
        console.log('🔍 Change detected: Room removed', cachedRoom.roomName);
        return true;
      }
    }

    return false;
  }, []);

  // Load chat rooms with offline-first approach
  const loadChatRooms = useCallback(async (forceRefresh: boolean = false) => {
    try {
      // Step 1: Load cached data first (if not force refresh)
      if (!forceRefresh) {
        const cachedData = await ChatRoomStorage.getChatRooms();
        const cachedLastMessages = await ChatRoomStorage.getLastMessages();

        if (cachedData && cachedData.rooms.length > 0) {
          console.log("📦 Found cached chat rooms, displaying immediately");
          console.log(`   Cached ${cachedData.rooms.length} rooms from ${new Date(cachedData.timestamp).toLocaleTimeString()}`);

          // Apply cached last messages if available
          if (cachedLastMessages) {
            setLastMessages(prev => ({
              ...prev,
              ...cachedLastMessages.messages
            }));
          }

          const extendedRooms: ExtendedChatRoom[] = cachedData.rooms.map((room) => ({
            ...room,
            unreadCount: 0,
            lastMessage: cachedLastMessages?.messages?.[room.roomId?.toString() || ''] || undefined,
            onlineCount: 0,
          }));

          const roomsWithData = updateRoomsWithData(
            extendedRooms,
            cachedLastMessages?.messages || {},
            unreadCounts
          );
          const sortedRooms = sortRoomsByRecent(roomsWithData);

          setChatRooms(sortedRooms);
          setFilteredChatRooms(sortedRooms);
          
          // Hide loading spinner immediately after showing cache
          setIsLoading(false);
          isInitialLoad.current = false;
        }
      }

      // Step 2: Fetch fresh data from server in background
      console.log("🔄 Syncing with server in background...");
      setIsSyncing(true);

      const freshRooms = await fetchChatRooms();

      // Step 3: Get cached data for comparison
      const cachedData = await ChatRoomStorage.getChatRooms();
      const hasChanges = detectChanges(cachedData?.rooms || [], freshRooms);

      if (hasChanges || forceRefresh) {
        console.log("✨ Changes detected, updating cache and UI");

        // Save to cache
        await ChatRoomStorage.saveChatRooms(freshRooms);

        const extendedRooms: ExtendedChatRoom[] = freshRooms.map((room) => ({
          ...room,
          unreadCount: unreadCounts[room.roomId?.toString() || ''] || 0,
          lastMessage: lastMessages[room.roomId?.toString() || ''] || undefined,
          onlineCount: 0,
        }));

        const roomsWithData = updateRoomsWithData(extendedRooms, lastMessages, unreadCounts);
        const sortedRooms = sortRoomsByRecent(roomsWithData);

        setChatRooms(sortedRooms);
        
        // Update filtered rooms based on search query
        if (searchQuery.trim() === '') {
          setFilteredChatRooms(sortedRooms);
        } else {
          const filtered = sortedRooms.filter(room =>
            room.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setFilteredChatRooms(filtered);
        }
      } else {
        console.log("✅ No changes detected, cache is up to date");
      }

      // Check admin status
      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUser(userData);
      }

    } catch (error) {
      console.error("❌ Error fetching from server:", error);

      // If server fetch fails but we have cache, we're still okay
      const cachedData = await ChatRoomStorage.getChatRooms();
      if (cachedData && cachedData.rooms.length > 0) {
        console.log("📦 Using cached data due to network error");
        // Data is already displayed from cache, just log the error
      } else {
        console.error("❌ No cached data available and server fetch failed");
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
      setRefreshing(false);
      isInitialLoad.current = false;
    }
  }, [lastMessages, unreadCounts, searchQuery, detectChanges]);

  // Save last messages to cache whenever they update
  useEffect(() => {
    if (Object.keys(lastMessages).length > 0) {
      ChatRoomStorage.saveLastMessages(lastMessages);
    }
  }, [lastMessages]);

  // Initialize socket and setup listeners
  const initializeSocket = useCallback(async () => {
    console.log("🔌 Initializing socket connection...");

    try {
      const userData = await AuthStorage.getUser();
      if (!userData) {
        console.log("❌ No user data found");
        return;
      }

      setCurrentUser(userData);

      const socket = socketService.connect();
      if (socket) {
        console.log("✅ Socket connected, identifying user:", userData.userId);
        socketService.identify(userData.userId);

        if (!hasSetOnline.current) {
          console.log("🟢 Setting user online globally:", userData.userId);
          socketService.setUserOnline(userData.userId);
          hasSetOnline.current = true;
        }

        // Clear existing listeners to prevent duplicates
        socket.off("lastMessage");
        socket.off("unreadCounts");
        socket.off("roomUpdate");
        socket.off("onlineUsers");
        socket.off("userOnlineStatusUpdate");

        // Listen for user online status updates
        socket.on("userOnlineStatusUpdate", (data: { userId: string; isOnline: boolean }) => {
          console.log("👤 User online status update:", data);
        });

        // Set up lastMessage listener
        socket.on("lastMessage", (data: LastMessageResponse) => {
          if (data && data.lastMessageByRoom) {
            setLastMessages(prevMessages => {
              const newMessages = {
                ...prevMessages,
                ...data.lastMessageByRoom
              };
              // Save to cache
              ChatRoomStorage.saveLastMessages(newMessages);
              return newMessages;
            });

            setChatRooms(prevRooms => {
              if (prevRooms.length === 0) {
                console.log("⚠️ No rooms to update yet");
                return prevRooms;
              }

              const updatedRooms = updateRoomsWithData(prevRooms, {
                ...lastMessages,
                ...data.lastMessageByRoom
              }, unreadCounts);
              const sortedRooms = sortRoomsByRecent(updatedRooms);
              return sortedRooms;
            });
          }
        });

        // Set up unreadCounts listener
        socket.on("unreadCounts", (data: UnreadCountsEvent) => {
          if (data && data.unreadCounts) {
            setUnreadCounts(prevCounts => ({
              ...prevCounts,
              ...data.unreadCounts
            }));

            setChatRooms(prevRooms => {
              if (prevRooms.length === 0) {
                return prevRooms;
              }

              const updatedRooms = updateRoomsWithData(prevRooms, lastMessages, {
                ...unreadCounts,
                ...data.unreadCounts
              });
              return sortRoomsByRecent(updatedRooms);
            });
          }
        });

        // Set up roomUpdate listener for real-time updates
        socket.on("roomUpdate", (data: RoomUpdateEvent) => {
          if (data && data.roomId) {
            const roomIdStr = data.roomId.toString();

            setLastMessages(prevMessages => {
              const newMessages = {
                ...prevMessages,
                [roomIdStr]: data.lastMessage
              };
              // Save to cache
              ChatRoomStorage.saveLastMessages(newMessages);
              return newMessages;
            });

            setUnreadCounts(prevCounts => ({
              ...prevCounts,
              [roomIdStr]: data.unreadCount
            }));

            setChatRooms(prevRooms => {
              const updatedRooms = prevRooms.map(room => {
                if (room.roomId?.toString() === roomIdStr) {
                  return {
                    ...room,
                    lastMessage: data.lastMessage,
                    unreadCount: data.unreadCount
                  };
                }
                return room;
              });
              return sortRoomsByRecent(updatedRooms);
            });
          }
        });

        // Listen for online users updates
        socket.on("onlineUsers", (data: { roomId: string; onlineUsers: string[]; onlineCount: number; totalMembers: number }) => {
          if (data && data.roomId) {
            const roomIdStr = data.roomId.toString();

            setChatRooms(prevRooms => {
              const updatedRooms = prevRooms.map(room => {
                if (room.roomId?.toString() === roomIdStr) {
                  return {
                    ...room,
                    onlineCount: data.onlineCount
                  };
                }
                return room;
              });

              if (searchQuery.trim() === '') {
                setFilteredChatRooms(updatedRooms);
              } else {
                const filtered = updatedRooms.filter(room =>
                  room.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
                );
                setFilteredChatRooms(filtered);
              }

              return updatedRooms;
            });
          }
        });

        // Listen for new room created event
        socket.on("newRoomCreated", async (data: { room: ChatRoom }) => {
          console.log("🆕 New room created:", data.room.roomName);
          
          // Add to current state
          setChatRooms(prevRooms => {
            const newRoom: ExtendedChatRoom = {
              ...data.room,
              unreadCount: 0,
              lastMessage: undefined,
              onlineCount: 0,
            };
            const updatedRooms = [newRoom, ...prevRooms];
            
            // Update filtered rooms
            if (searchQuery.trim() === '') {
              setFilteredChatRooms(updatedRooms);
            }
            
            // Update cache
            const roomsForCache = updatedRooms.map(r => ({
              ...r,
              unreadCount: undefined,
              lastMessage: undefined,
              onlineCount: undefined,
            })) as ChatRoom[];
            ChatRoomStorage.saveChatRooms(roomsForCache);
            
            return updatedRooms;
          });
        });

        // Listen for room deleted event
        socket.on("roomDeleted", async (data: { roomId: string }) => {
          console.log("🗑️ Room deleted:", data.roomId);
          
          setChatRooms(prevRooms => {
            const updatedRooms = prevRooms.filter(
              room => room.roomId?.toString() !== data.roomId
            );
            
            // Update filtered rooms
            if (searchQuery.trim() === '') {
              setFilteredChatRooms(updatedRooms);
            } else {
              const filtered = updatedRooms.filter(room =>
                room.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
              );
              setFilteredChatRooms(filtered);
            }
            
            // Update cache
            const roomsForCache = updatedRooms.map(r => ({
              ...r,
              unreadCount: undefined,
              lastMessage: undefined,
              onlineCount: undefined,
            })) as ChatRoom[];
            ChatRoomStorage.saveChatRooms(roomsForCache);
            
            return updatedRooms;
          });
        });

        // Request room data after setting up listeners
        setTimeout(() => {
          socketService.requestRoomData(userData.userId);
        }, 10);

      } else {
        console.error("❌ Failed to connect socket");
      }
    } catch (error) {
      console.error("❌ Error initializing socket:", error);
    }
  }, [lastMessages, unreadCounts, searchQuery]);


  useEffect(() => {
    initializeSocket();

    const handleOpenChatRoom = (data: { roomId: string }) => {
      const { roomId } = data;
      console.log('💬 Opening chat room from notification:', roomId);

      const roomExists = chatRooms.some(room => room.roomId?.toString() === roomId);

      if (roomExists) {
        router.push(`/chat/${roomId}`);
      } else {
        loadChatRooms(true).then(() => {
          setTimeout(() => {
            router.push(`/chat/${roomId}`);
          }, 300);
        }).catch(error => {
          console.error('❌ Error refreshing chat rooms:', error);
          router.push(`/chat/${roomId}`);
        });
      }
    };

    eventEmitter.on('openChatRoom', handleOpenChatRoom);

    return () => {
      eventEmitter.off('openChatRoom', handleOpenChatRoom);
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      const userData = await AuthStorage.getUser();

      if (appState.match(/inactive|background/) && nextAppState === "active") {
        console.log("📱 App came to foreground");
        loadChatRooms(); // Will show cache first, then sync
        initializeSocket();

        if (userData && socketService.isConnected()) {
          console.log("🟢 Setting user online (foreground):", userData.userId);
          socketService.setUserOnline(userData.userId);
        }
      } else if (appState === "active" && nextAppState.match(/inactive|background/)) {
        console.log("📱 App went to background");
        if (userData && socketService.isConnected()) {
          console.log("🔴 Setting user offline (background):", userData.userId);
          socketService.setUserOffline(userData.userId);
        }
      }

      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, loadChatRooms, initializeSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hasSetOnline.current = false;
    };
  }, []);

  // Main focus effect
  useFocusEffect(
    useCallback(() => {
      console.log("useCallback is running in");
      loadChatRooms();

      const socketTimer = setTimeout(() => {
        initializeSocket();
      }, 1);

      const notifyChatTabEntry = async () => {
        const userData = await AuthStorage.getUser();
        if (userData && socketService.socket?.connected) {
          socketService.enterChatTab(userData.userId);
          await setUserOnline(userData.userId);
        }
      };

      const notifyTimer = setTimeout(notifyChatTabEntry, 1500);

      return () => {
        clearTimeout(socketTimer);
        clearTimeout(notifyTimer);

        const notifyChatTabExit = async () => {
          const userData = await AuthStorage.getUser();
          if (userData && socketService.socket?.connected) {
            socketService.leaveChatTab(userData.userId);
          }
        };
        notifyChatTabExit();

        if (socketService.socket) {
          socketService.socket.off("lastMessage");
          socketService.socket.off("unreadCounts");
          socketService.socket.off("roomUpdate");
          socketService.socket.off("userOnlineStatusUpdate");
          socketService.socket.off("newRoomCreated");
          socketService.socket.off("roomDeleted");
        }
      };
    }, [])
  );

  // Effect to update rooms when lastMessages or unreadCounts change
  useEffect(() => {
    if ((Object.keys(lastMessages).length > 0 || Object.keys(unreadCounts).length > 0) && chatRooms.length > 0) {
      console.log("🔄 Room data updated, refreshing room list");
      setChatRooms(prevRooms => {
        const updatedRooms = updateRoomsWithData(prevRooms, lastMessages, unreadCounts);
        const sortedRooms = sortRoomsByRecent(updatedRooms);

        if (searchQuery.trim() === '') {
          setFilteredChatRooms(sortedRooms);
        } else {
          const filtered = sortedRooms.filter(room =>
            room.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setFilteredChatRooms(filtered);
        }

        return sortedRooms;
      });
    }
  }, [lastMessages, unreadCounts]);

  const onRefresh = useCallback(() => {
    console.log("🔄 Manual refresh triggered");
    setRefreshing(true);
    loadChatRooms(true); // Force refresh on pull-to-refresh
    initializeSocket();
  }, [loadChatRooms, initializeSocket]);

  const navigateToChatRoom = (roomId: string) => {
    setChatRooms((prevRooms) => {
      const updatedRooms = prevRooms.map((room) => {
        if (room.roomId?.toString() === roomId) {
          return { ...room, unreadCount: 0 };
        }
        return room;
      });

      if (searchQuery.trim() === '') {
        setFilteredChatRooms(updatedRooms);
      } else {
        const filtered = updatedRooms.filter(room =>
          room.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredChatRooms(filtered);
      }

      return updatedRooms;
    });

    setUnreadCounts(prev => ({
      ...prev,
      [roomId]: 0
    }));

    router.push({
      pathname: "/chat/[roomId]",
      params: { roomId },
    });
  };

  const formatMessageTime = (timestamp: string) => {
    if (!timestamp) return "";

    try {
      return getRelativeTimeIST(timestamp);
    } catch (error) {
      console.error("Error formatting time:", error);
      return "";
    }
  };

  const renderChatRoomItem = ({ item }: { item: ExtendedChatRoom }) => {
    const RoomItem = () => {
      let messagePreview = "";

      if (item.lastMessage) {
        const senderPrefix =
          item.lastMessage.sender.userId === currentUser?.userId
            ? "You: "
            : `${item.lastMessage.sender.userName}: `;

        if (item.lastMessage.messageType === "text" && item.lastMessage.messageText) {
          messagePreview = senderPrefix + item.lastMessage.messageText;
        } else if (item.lastMessage.pollId) {
          messagePreview = senderPrefix + "shared a poll";
        } else if (item.lastMessage.tableId) {
          messagePreview = senderPrefix + "shared a table";
        } else if (item.lastMessage.mediaFilesId) {
          messagePreview = senderPrefix + "shared media";
        } else {
          messagePreview = senderPrefix + "sent a message";
        }
      } else if (item.roomDescription) {
        messagePreview = item.roomDescription;
      } else {
        messagePreview = "No messages yet";
      }

      const timeText = item.lastMessage
        ? formatMessageTime(item.lastMessage.createdAt)
        : "";

      const hasUnread = item.unreadCount && item.unreadCount > 0;
      const unreadText = hasUnread
        ? (item.unreadCount ?? 0) > 99
          ? "99+"
          : (item.unreadCount ?? 0).toString()
        : "";

      const backgroundColor = hasUnread ? "bg-white" : "bg-gray-50";
      const roomNameColor = hasUnread ? "text-gray-900" : "text-gray-700";
      const messageColor = hasUnread ? "text-gray-700" : "text-gray-500";
      const timeColor = hasUnread ? "text-gray-600" : "text-gray-400";
      const borderColor = hasUnread ? "border-gray-200" : "border-gray-100";

      return (
        <TouchableOpacity
          className={`${backgroundColor} p-4 border-b ${borderColor}`}
          activeOpacity={0.7}
          onPress={() => {
            if (item.roomId !== undefined) {
              navigateToChatRoom(item.roomId.toString());
            } else {
              console.error("Chat room ID is undefined:", item);
              alert("Cannot open this chat room. ID is missing.");
            }
          }}
        >
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-blue-100 rounded-full justify-center items-center mr-3 relative">
              <Ionicons
                name={item.isGroup ? "people" : "person"}
                size={24}
                color="#0284c7"
              />

              {/* {item.onlineCount && item.onlineCount > 0 ? (
                <View className="absolute top-0 right-0 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {item.onlineCount}
                  </Text>
                </View>
              ) : null} */}
            </View>

            <View className="flex-1">
              <View className="flex-row justify-between items-center">
                <Text className={`text-lg font-bold ${roomNameColor}`}>
                  {item.roomName}
                </Text>
                {timeText ? (
                  <Text className={`text-xs ${timeColor}`}>{timeText}</Text>
                ) : null}
              </View>

              <View className="flex-row justify-between items-center mt-1">
                <Text
                  className={`flex-1 text-sm mr-2 ${messageColor}`}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {messagePreview}
                </Text>

                {hasUnread ? (
                  <View className="bg-blue-500 rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    <Text className="text-white text-xs font-bold">
                      {unreadText}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

    return <RoomItem />;
  };

  // Show loading only on initial load when no cache
  if (isLoading && isInitialLoad.current) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-gray-500 mt-2">Loading chats...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient
        colors={["#3b82f6", "#3b82f6", "#3b82f6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="flex-row items-center justify-between h-[60px] px-4"
        style={{
          elevation: 8,
          shadowColor: "#6366f1",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }}
      >
        <TouchableOpacity onPress={()=>navigation.dispatch(DrawerActions.openDrawer())} className="p-1">
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>

        <View className="flex-1 items-center flex-row justify-center">
          <Text className="text-[22px] font-bold text-white tracking-wide">
            Sevak App
          </Text>
          {/* Optional: Small sync indicator */}
          {isSyncing && (
            <ActivityIndicator 
              size="small" 
              color="#fff" 
              style={{ marginLeft: 8 }}
            />
          )}
        </View>

        <View className="w-[38px]" />
      </LinearGradient>

      {/* Search Bar */}
      <View className="p-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3">
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            placeholder="Search chat rooms..."
            className="flex-1 ml-3 text-gray-800"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredChatRooms}
        keyExtractor={(item) =>
          item.roomId?.toString() || Math.random().toString()
        }
        renderItem={renderChatRoomItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0284c7"]}
          />
        }
        ListEmptyComponent={() => (
          <NoChatRoomComponenet searchQuery={searchQuery} />
        )}
      />
    </View>
  );
}