// // app/chat/[roomId].tsx
// import React, { useEffect, useState, useRef } from 'react';
// import { 
//   View, 
//   Text, 
//   FlatList, 
//   TextInput, 
//   TouchableOpacity, 
//   ActivityIndicator,
//   KeyboardAvoidingView,
//   Platform,
//   SafeAreaView
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { useLocalSearchParams, router, useNavigation } from 'expo-router';
// import { AuthStorage } from '@/utils/authStorage';
// import { Message, ChatRoom, ChatUser } from '@/types/type';
// import axios from 'axios';
// import { API_URL } from '@/constants/api';
// import { useFocusEffect } from '@react-navigation/native';
// import { useCallback } from 'react';

// interface RoomDetails extends ChatRoom {
//   members: ChatUser[];
//   messages: Message[];
// }

// export default function ChatRoomScreen() {
//   const { roomId } = useLocalSearchParams();
//   console.log("roomId in chat room screen",roomId);
//   const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [messageText, setMessageText] = useState('');
//   const [isAdmin, setIsAdmin] = useState(false);
//   const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
//   const [currentUser, setCurrentUser] = useState<any>(null);
//   const flatListRef = useRef<FlatList>(null);
//   const navigation = useNavigation();
//   console.log("roomdetails",roomDetails);
//   console.log("current User",currentUser);
//   // Set the header title and options
//     // Load room details and check if user is admin

// useFocusEffect(
//   useCallback(() => {
//     // This will run when the screen comes into focus
//     if (roomId) {
//       loadRoomDetails();
//     }
//     return () => {
//       // Optional cleanup
//     };
//   }, [roomId,isAdmin])
// );
//   useEffect(() => {
//     if (roomDetails) {
//       console.log("while setting header",isAdmin)
//       // Change this in [roomId].tsx
//       navigation.setOptions({
//         title: roomDetails.roomName,
//         headerRight: () => isAdmin ? (
//           <TouchableOpacity 
//             onPressIn={() => {
//               console.log("Navigating to room settings with roomId:", roomId);
//               router.push({
//                 pathname: "/chat/room-settings",
//                 params: { roomId }
//               });
//             }}
//             className="mr-2"
//           >
//             <Ionicons name="settings-outline" size={24} color="#0284c7" />
//           </TouchableOpacity>
//         ) : null
//       });
//     }
//   }, [roomDetails, isAdmin]);
//     const loadRoomDetails = async () => {
//       try {
//         setIsLoading(true);
        
//         // Get current user
//         const userData = await AuthStorage.getUser();
//         setCurrentUser(userData);
        
//         // Fetch room details
//         const token = await AuthStorage.getToken();
//         const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
//           headers: { Authorization: `Bearer ${token}` }
//         });
        
//         setRoomDetails(response.data);
//         setMessages(response.data.messages || []);
//          // Check if current user is admin of this room
//          const isUserAdmin = response.data.members.some(
//           (member: any) => member.userId === userData?.userId && member.isAdmin
//         );
//         setIsAdmin(isUserAdmin);
//         console.log("is user room admin",isUserAdmin);
        
        
//         // For demo purposes, randomly set some users as online
//         const memberIds = response.data.members.map((m: any) => m.userId);
//         const randomOnlineUsers = memberIds.filter(() => Math.random() > 0.5);
//         setOnlineUsers(randomOnlineUsers);
        
//       } catch (error) {
//         console.error('Error loading room details:', error);
//         alert('Failed to load chat room details');
//       } finally {
//         setIsLoading(false);
//       }
//     };
//   const sendMessage = async () => {
//     if (!messageText.trim() || !roomId || !currentUser) return;
    
//     try {
//       const token = await AuthStorage.getToken();
//       const response = await axios.post(
//         `${API_URL}/api/chat/rooms/${roomId}/messages`, 
//         { messageText },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
      
//       // Add the new message to the list
//       const newMessage = {
//         ...response.data,
//         senderName: currentUser.fullName || 'You'
//       };
      
//       setMessages(prev => [...prev, newMessage]);
//       setMessageText('');
      
//       // Scroll to the bottom
//       setTimeout(() => {
//         flatListRef.current?.scrollToEnd({ animated: true });
//       }, 100);
      
//     } catch (error) {
//       console.error('Error sending message:', error);
//       alert('Failed to send message');
//     }
//   };

//   const renderMessage = ({ item }: { item: Message }) => {
//     const isOwnMessage = item.senderId === currentUser?.userId;
    
//     return (
//       <View className={`p-2 max-w-[80%] rounded-lg my-1 ${isOwnMessage ? 'bg-blue-500 self-end' : 'bg-gray-200 self-start'}`}>
//         {!isOwnMessage && (
//           <Text className="text-xs font-bold text-gray-600">{item.senderName || 'Unknown'}</Text>
//         )}
//         <Text className={isOwnMessage ? 'text-white' : 'text-black'}>{item.messageText}</Text>
//         <Text className={`text-xs ${isOwnMessage ? 'text-blue-100 text-right' : 'text-gray-500'}`}>
//           {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//         </Text>
//       </View>
//     );
//   };

//   if (isLoading) {
//     return (
//       <View className="flex-1 justify-center items-center">
//         <ActivityIndicator size="large" color="#0284c7" />
//       </View>
//     );
//   }

//   if (!roomDetails) {
//     return (
//       <View className="flex-1 justify-center items-center p-4">
//         <Ionicons name="alert-circle-outline" size={60} color="#d1d5db" />
//         <Text className="text-gray-500 mt-4 text-center">
//           Chat room not found or you don't have access.
//         </Text>
//         <TouchableOpacity 
//           className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
//           onPress={() => router.back()}
//         >
//           <Text className="text-white font-bold">Go Back</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   return (
//     <SafeAreaView className="flex-1 bg-white">
//       <KeyboardAvoidingView 
//         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//         className="flex-1"
//         keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
//       >
//         {/* Online users indicator */}
//         <View className="px-4 py-2 bg-gray-100 border-b border-gray-200">
//           <Text className="text-gray-600 text-sm">
//             {onlineUsers.length} / {roomDetails.members.length} members online
//           </Text>
//         </View>
        
//         {/* Messages list */}
//         <FlatList
//           ref={flatListRef}
//           data={messages}
//           keyExtractor={(item) => item.id.toString()}
//           renderItem={renderMessage}
//           contentContainerStyle={{ padding: 10 }}
//           onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
//           ListEmptyComponent={
//             <View className="flex-1 justify-center items-center p-4 mt-10">
//               <Ionicons name="chatbubble-outline" size={60} color="#d1d5db" />
//               <Text className="text-gray-500 mt-4 text-center">
//                 No messages yet. Be the first to send a message!
//               </Text>
//             </View>
//           }
//         />
        
//         {/* Message input */}
//         <View className="p-2 border-t border-gray-200 bg-white flex-row items-center">
//           <TextInput
//             className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
//             placeholder="Type a message..."
//             value={messageText}
//             onChangeText={setMessageText}
//             multiline
//           />
//           <TouchableOpacity 
//             className={`rounded-full p-2 ${messageText.trim() ? 'bg-blue-500' : 'bg-gray-300'}`}
//             onPress={sendMessage}
//             disabled={!messageText.trim()}
//           >
//             <Ionicons name="send" size={24} color="white" />
//           </TouchableOpacity>
//         </View>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }






// app/chat/[roomId].tsx - Update imports and components
import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';
import { Message, ChatRoom, ChatUser } from '@/types/type';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import socketService from '@/utils/socketService';
import OnlineUsersIndicator from '@/components/chat/OnlineUsersIndicator';
import MembersModal from '@/components/chat/MembersModal';
interface RoomDetails extends ChatRoom {
  members: ChatUser[];
  messages: Message[];
}

interface RoomMember extends ChatUser {
  isOnline?: boolean;
}

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams();
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  
  // Connect to socket when component mounts
  useEffect(() => {
    const socket = socketService.connect();
    
    return () => {
      // Clean up socket listeners when component unmounts
      socketService.removeListeners();
    };
  }, []);
  
// app/chat/[roomId].tsx - Update the useEffect for socket events
useEffect(() => {
  if (roomId && currentUser) {
    // Join the room
    socketService.joinRoom(
      roomId as string, 
      currentUser.userId, 
      currentUser.fullName || 'Anonymous'
    );
    
    // Listen for online users updates
    socketService.onOnlineUsers(({ roomId: updatedRoomId, onlineUsers: users }) => {
      if (updatedRoomId === roomId) {
        console.log("Online users updated:", users);
        setOnlineUsers(users);
      }
    });
    
    // Listen for room members updates
    socketService.onRoomMembers(({ roomId: updatedRoomId, members }) => {
      if (updatedRoomId === roomId) {
        console.log("Room members updated:", members);
        setRoomMembers(members.map(member => ({
          ...member,
          fullName: member.fullName ?? undefined,
          isOnline: !!member.isOnline
        })));
      }
    }); 
    
    return () => {
      // Leave the room when component unmounts
      socketService.leaveRoom(roomId as string, currentUser.userId);
    };
  }
}, [roomId, currentUser]);

  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        loadRoomDetails();
      }
      return () => {
        // Optional cleanup
      };
    }, [roomId])
  );
  
  useEffect(() => {
    if (roomDetails) {
      console.log("while setting header",isAdmin)
      // Change this in [roomId].tsx
      navigation.setOptions({
        title: roomDetails.roomName,
        headerRight: () => isAdmin ? (
          <TouchableOpacity 
            onPressIn={() => {
              console.log("Navigating to room settings with roomId:", roomId);
              router.push({
                pathname: "/chat/room-settings",
                params: { roomId }
              });
            }}
            className="mr-2"
          >
            <Ionicons name="settings-outline" size={24} color="#0284c7" />
          </TouchableOpacity>
        ) : null
      });
    }
  }, [roomDetails, isAdmin]);
  
// app/chat/[roomId].tsx (continued)

// app/chat/[roomId].tsx - Update loadRoomDetails
const loadRoomDetails = async () => {
  try {
    setIsLoading(true);
    
    // Get current user
    const userData = await AuthStorage.getUser();
    setCurrentUser(userData);
    console.log("userdata is",userData);
    
    // Fetch room details
    const token = await AuthStorage.getToken();
    const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    setRoomDetails(response.data);
    setMessages(response.data.messages || []);
    
    // Check if current user is admin of this room
    const isUserAdmin = response.data.members.some(
      (member: ChatUser) => member.userId === userData?.userId && member.isAdmin
    );
    setIsAdmin(isUserAdmin);
    console.log("is admin",isAdmin);
    
    // Initialize room members with online status
    const initialMembers = response.data.members.map((member: ChatUser) => ({
      ...member,
      isOnline: false // Will be updated by socket events
    }));
    setRoomMembers(initialMembers);
    
    // Join the room via socket after loading details
    if (userData) {
      socketService.joinRoom(
        roomId as string,
        userData.userId,
        userData.fullName || 'Anonymous'
      );
    }
    
  } catch (error) {
    console.error('Error loading room details:', error);
    alert('Failed to load chat room details');
  } finally {
    setIsLoading(false);
  }
};

const sendMessage = async () => {
  if (!messageText.trim() || !roomId || !currentUser) return;
  
  try {
    const token = await AuthStorage.getToken();
    const response = await axios.post(
      `${API_URL}/api/chat/rooms/${roomId}/messages`, 
      { messageText },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // Add the new message to the list
    const newMessage = {
      ...response.data,
      senderName: currentUser.fullName || 'You'
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessageText('');
    
    // Send the message via socket
    socketService.sendMessage(
      roomId as string,
      newMessage,
      { userId: currentUser.userId, userName: currentUser.fullName || 'Anonymous' }
    );
    
    // Scroll to the bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message');
  }
};

const renderMessage = ({ item }: { item: Message }) => {
  const isOwnMessage = item.senderId === currentUser?.userId;
  
  return (
    <View className={`p-2 max-w-[80%] rounded-lg my-1 ${isOwnMessage ? 'bg-blue-500 self-end' : 'bg-gray-200 self-start'}`}>
      {!isOwnMessage && (
        <Text className="text-xs font-bold text-gray-600">{item.senderName || 'Unknown'}</Text>
      )}
      <Text className={isOwnMessage ? 'text-white' : 'text-black'}>{item.messageText}</Text>
      <Text className={`text-xs ${isOwnMessage ? 'text-blue-100 text-right' : 'text-gray-500'}`}>
        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
};

// Render a member item in the members modal
const renderMemberItem = ({ item }: { item: RoomMember }) => (
  <View className="flex-row items-center justify-between p-3 border-b border-gray-100">
    <View className="flex-row items-center">
      <View className={`w-10 h-10 rounded-full justify-center items-center mr-3 ${item.isOnline ? 'bg-green-100' : 'bg-gray-100'}`}>
        <Text className={`font-bold ${item.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
          {(item.fullName || 'U').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View>
        <Text className={`font-bold ${item.isOnline ? 'text-black' : 'text-gray-400'}`}>
          {item.fullName || 'Unknown User'} {item.userId === currentUser?.userId ? '(You)' : ''}
        </Text>
        <Text className={`text-xs ${item.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
          {item.isAdmin ? 'Admin • ' : ''}{item.isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
    </View>
    
    {item.isOnline && (
      <View className="h-3 w-3 bg-green-500 rounded-full"></View>
    )}
  </View>
);

if (isLoading) {
  return (
    <View className="flex-1 justify-center items-center">
      <ActivityIndicator size="large" color="#0284c7" />
    </View>
  );
}

if (!roomDetails) {
  return (
    <View className="flex-1 justify-center items-center p-4">
      <Ionicons name="alert-circle-outline" size={60} color="#d1d5db" />
      <Text className="text-gray-500 mt-4 text-center">
        Chat room not found or you don't have access.
      </Text>
      <TouchableOpacity 
        className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
        onPress={() => router.back()}
      >
        <Text className="text-white font-bold">Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

return (
  <SafeAreaView className="flex-1 bg-white">
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Online users indicator - Now clickable */}
      <OnlineUsersIndicator 
      onlineCount={onlineUsers.length} 
      totalCount={roomDetails.members.length}
      onPress={() => setShowMembersModal(true)}
      />
      
      {/* Messages list */}
      <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderMessage}
      contentContainerStyle={{ padding: 10 }}
      onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      ListEmptyComponent={
        <View className="flex-1 justify-center items-center p-4 mt-10">
        <Ionicons name="chatbubble-outline" size={60} color="#d1d5db" />
        <Text className="text-gray-500 mt-4 text-center">
          No messages yet. Be the first to send a message!
        </Text>
        </View>
      }
      />
      
      {/* Message input */}
      <View className="p-2 border-t border-gray-200 bg-white flex-row items-center">
      <TextInput
        className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
        placeholder="Type a message..."
        value={messageText}
        onChangeText={setMessageText}
        multiline
      />
      <TouchableOpacity 
        className={`rounded-full p-2 ${messageText.trim() ? 'bg-blue-500' : 'bg-gray-300'}`}
        onPress={sendMessage}
        disabled={!messageText.trim()}
      >
        <Ionicons name="send" size={24} color="white" />
      </TouchableOpacity>
      </View>
      
      {/* Members Modal */}
      <MembersModal
        visible={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        members={roomMembers.map(member => ({
          userId: member.userId,
          fullName: member.fullName || 'Unknown User',
          isAdmin: Boolean(member.isAdmin),
          isOnline: Boolean(member.isOnline)
        }))}
        currentUserId={currentUser?.userId || ''}
      />
    </KeyboardAvoidingView>
  </SafeAreaView>
);
}