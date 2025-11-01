import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  AppState,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { fetchChatRooms } from "@/api/chat";
import { AuthStorage } from "@/utils/authStorage";
import { ChatRoom } from "@/types/type";
import { useFocusEffect } from "@react-navigation/native";
import socketService from "@/utils/socketService";
import { formatDistanceToNow } from "date-fns";
import eventEmitter from "@/utils/eventEmitter";
import { getRelativeTimeIST, formatISTTime } from "@/utils/dateUtils";

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

interface MentionSegment {
  text: string;
  isMention: boolean;
  userId?: string;
  isCurrentUser?: boolean;
}

export default function ChatRooms() {
  
  const [chatRooms, setChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [filteredChatRooms, setFilteredChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [lastMessages, setLastMessages] = useState<{ [key: string]: LastMessageData }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const pathname = usePathname();

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

        socket.off("lastMessage");
        socket.off("unreadCounts");
        socket.off("roomUpdate");

        socket.on("lastMessage", (data: LastMessageResponse) => {
          console.log("📨 Received lastMessage event:", data);

          if (data && data.lastMessageByRoom) {
            console.log("📋 Updating last messages:", Object.keys(data.lastMessageByRoom));

            setLastMessages(prevMessages => ({
              ...prevMessages,
              ...data.lastMessageByRoom
            }));

            setChatRooms(prevRooms => {
              if (prevRooms.length === 0) {
                console.log("⚠️ No rooms to update yet");
                return prevRooms;
              }

              console.log("🔄 Updating chat rooms with last messages");
              const updatedRooms = updateRoomsWithData(prevRooms, {
                ...lastMessages,
                ...data.lastMessageByRoom
              }, unreadCounts);
              const sortedRooms = sortRoomsByRecent(updatedRooms);
              console.log("✅ Updated rooms count:", sortedRooms.length);
              return sortedRooms;
            });
          }
        });

        socket.on("unreadCounts", (data: UnreadCountsEvent) => {
          console.log("📊 Received unreadCounts event:", data);

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

        socket.on("roomUpdate", (data: RoomUpdateEvent) => {
          console.log("🔄 Received roomUpdate event:", data);

          if (data && data.roomId) {
            const roomIdStr = data.roomId.toString();

            setLastMessages(prevMessages => ({
              ...prevMessages,
              [roomIdStr]: data.lastMessage
            }));

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

        setTimeout(() => {
          socketService.requestRoomData(userData.userId);
        }, 10);

      } else {
        console.error("❌ Failed to connect socket");
      }
    } catch (error) {
      console.error("❌ Error initializing socket:", error);
    }
  }, [lastMessages, unreadCounts]);

  // Load chat rooms and apply last messages
  const loadChatRooms = useCallback(async () => {
    try {
      console.log("📥 Loading chat rooms...");
      setIsLoading(true);

      const rooms = await fetchChatRooms();
      console.log("📋 Fetched rooms:", rooms.length);

      const extendedRooms: ExtendedChatRoom[] = rooms.map((room) => ({
        ...room,
        unreadCount: 0,
        lastMessage: undefined,
        onlineCount: 0,
      }));

      const roomsWithData = updateRoomsWithData(extendedRooms, lastMessages, unreadCounts);
      const sortedRooms = sortRoomsByRecent(roomsWithData);

      setChatRooms(sortedRooms);
      setFilteredChatRooms(sortedRooms);
      console.log("✅ Chat rooms loaded and sorted");

      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUser(userData);
        const adminStatus = userData?.isAdmin || false;
        setIsAdmin(adminStatus);
      }

    } catch (error) {
      console.error("❌ Error loading chat rooms:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [lastMessages, unreadCounts]);

  useEffect(() => {
    initializeSocket();
    
    const handleOpenChatRoom = (data: { roomId: string }) => {
      const { roomId } = data;
      console.log('💬 Opening chat room from notification:', roomId);
      
      const roomExists = chatRooms.some(room => room.roomId?.toString() === roomId);
      
      if (roomExists) {
        console.log('✅ Room found in list, navigating to:', roomId);
        router.push(`/chat/${roomId}`);
      } else {
        console.log('🔄 Room not found in list, refreshing rooms and then navigating...');
        loadChatRooms().then(() => {
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
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);

      if (appState.match(/inactive|background/) && nextAppState === "active") {
        console.log("📱 App came to foreground, refreshing...");
        loadChatRooms();
        initializeSocket();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appState, currentUser, loadChatRooms, initializeSocket]);

  useFocusEffect(
    useCallback(() => {
      console.log("🎯 Chat routes focused");

      loadChatRooms();

      const socketTimer = setTimeout(() => {
        initializeSocket();
      }, 1);

      const notifyChatTabEntry = async () => {
        const userData = await AuthStorage.getUser();
        if (userData && socketService.socket?.connected) {
          socketService.enterChatTab(userData.userId);
        }
      };
      
      const notifyTimer = setTimeout(notifyChatTabEntry, 1500);

      return () => {
        console.log("🧹 Chat routes unfocused, cleaning up");
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
        }
      };
    }, [])
  );

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

    loadChatRooms();
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

  const parseMessageText = (text: string): MentionSegment[] => {
    const segments: MentionSegment[] = [];
    const mentionRegex = /<Text>([^<]+)<\/Text>/g;
    let lastIndex = 0;
    let match: any;
  
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, match.index),
          isMention: false
        });
      }
  
      const roomMembers: any = [];
      const mentionedUser = roomMembers.find((member: any) => 
        member.fullName?.toLowerCase() === match[1].toLowerCase()
      );
  
      if (mentionedUser) {
        segments.push({
          text: `@${match[1]}`,
          isMention: true,
          userId: mentionedUser.userId,
          isCurrentUser: mentionedUser.userId === currentUser?.userId
        });
      } else {
        segments.push({
          text: `@${match[1]}`,
          isMention: false
        });
      }
  
      lastIndex = match.index + match[0].length;
    }
  
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isMention: false
      });
    }
  
    return segments;
  };

  const renderMessageTextWithMentions = (text: string) => {
    const segments = parseMessageText(text);
    
    return (
      <Text>
        {segments.map((segment, index) => (
          <Text
            key={index}
            style={{
              color: segment.isMention
                ? segment.isCurrentUser
                  ? '#2563eb'
                  : '#2563eb'
                : '#6b7280',
              backgroundColor: segment.isMention && segment.isCurrentUser ? '#dbeafe' : 'transparent',
            }}
          >
            {segment.text}
          </Text>
        ))}
      </Text>
    );
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

      const backgroundColor = hasUnread ? "#fff" : "#f9fafb";
      const roomNameColor = hasUnread ? "#111827" : "#374151";
      const messageColor = hasUnread ? "#374151" : "#6b7280";
      const timeColor = hasUnread ? "#4b5563" : "#9ca3af";
      const borderColor = hasUnread ? "#e5e7eb" : "#f3f4f6";

      return (
        <TouchableOpacity
          style={{
            backgroundColor,
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
          }}
          onPress={() => {
            if (item.roomId !== undefined) {
              navigateToChatRoom(item.roomId.toString());
            } else {
              console.error("Chat room ID is undefined:", item);
              alert("Cannot open this chat room. ID is missing.");
            }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 48,
              height: 48,
              backgroundColor: '#dbeafe',
              borderRadius: 24,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
              position: 'relative',
            }}>
              <Ionicons
                name={item.isGroup ? "people" : "person"}
                size={24}
                color="#0284c7"
              />

              {item.onlineCount && item.onlineCount > 0 ? (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  backgroundColor: '#10b981',
                  borderRadius: 8,
                  width: 16,
                  height: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                    {item.onlineCount}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: roomNameColor }}>
                  {item.roomName}
                </Text>
                {timeText ? (
                  <Text style={{ fontSize: 12, color: timeColor }}>{timeText}</Text>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text
                  style={{ flex: 1, fontSize: 14, marginRight: 8, color: messageColor }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {renderMessageTextWithMentions(messagePreview)}
                </Text>

                {hasUnread ? (
                  <View style={{
                    backgroundColor: '#3b82f6',
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Search Bar */}
      <View 
        style={{ 
          padding: 16,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            placeholder="Search chat rooms..."
            style={{ flex: 1, marginLeft: 12, color: '#1f2937' }}
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

      {/* Chat Rooms FlatList */}
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
        contentContainerStyle={{ 
          flexGrow: 1,
        }}
        style={{ 
          flex: 1,
        }}
        ListEmptyComponent={() => (
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
            marginTop: 40,
          }}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={60}
              color="#d1d5db"
            />
            <Text style={{ color: '#6b7280', marginTop: 16, textAlign: 'center' }}>
              {searchQuery.length > 0
                ? "No chat rooms match your search."
                : "No chat rooms available."}
              {!searchQuery && isAdmin ? " Create one by tapping the + button." : ""}
            </Text>
          </View>
        )}
      />

      {/* Floating Action Button */}
      {isAdmin && (
        <TouchableOpacity
          onPress={() => router.push("/chat/create-room")}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            backgroundColor: '#3b82f6',
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}