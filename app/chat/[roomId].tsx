// // app/chat/[roomId].tsx
// import * as React from 'react';
// import { useEffect, useState, useRef, useCallback } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TextInput,
//   TouchableOpacity,
//   ActivityIndicator,
//   KeyboardAvoidingView,
//   Platform,
//   SafeAreaView,
//   AppState,
//   Pressable,
//   BackHandler,
//   Keyboard,
//   ScrollView,
//   Animated,
//   Modal,
// } from "react-native";
// import {
//   PanGestureHandler,
//   GestureHandlerRootView
// } from 'react-native-gesture-handler';
// import * as Haptics from 'expo-haptics';
// import { Ionicons } from "@expo/vector-icons";
// import { useLocalSearchParams, router, useNavigation } from "expo-router";
// import { AuthStorage } from "@/utils/authStorage";
// import { Message, ChatRoom, ChatUser } from "@/types/type";
// import { getISTTimestamp, formatISTTime, formatISTDate, isSameDayIST, getRelativeTimeIST } from "@/utils/dateUtils";
// import axios from "axios";
// import * as FileSystem from 'expo-file-system';
// import { API_URL } from "@/constants/api";
// import { useFocusEffect } from "@react-navigation/native";
// import socketService from "@/utils/socketService";
// import OnlineUsersIndicator from "@/components/chat/OnlineUsersIndicator";
// import MembersModal from "@/components/chat/MembersModal";
// import MessageStatus from "@/components/chat/MessageStatus";
// import GlobalPollModal from "@/components/chat/GlobalPollModal";
// import RenderTable from "@/components/chat/Attechments/RenderTable";
// import MediaViewerModal from "@/components/chat/MediaViewerModal";
// import ChatMessageOptions from "@/components/chat/ChatMessageOptions";
// import ForwardMessagesModal from "@/components/chat/ForwardMessagesModal";
// import MessageInput from "@/components/chat/MessageInput";
// import AudioRecorder from "@/components/chat/AudioRecorder";
// import AudioMessagePlayer from "@/components/chat/AudioMessagePlayer";
// import MediaGrid from "@/components/chat/MediaGrid";
// import WebView from 'react-native-webview';
// import { clearRoomNotifications } from "@/utils/chatNotificationHandler";
// import { getScheduledMessages } from "@/api/chat";
// import RenderHtml from 'react-native-render-html';
// import { useWindowDimensions } from 'react-native';

// interface RoomDetails extends ChatRoom {
//   members: ChatUser[];
//   messages: Message[];
// }

// export default function ChatRoomScreen() {
//   const { width: screenWidth } = useWindowDimensions();
//   const { roomId } = useLocalSearchParams();
//   const [room, setRoom] = useState<RoomDetails | null>(null);
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [messagesSet, setMessagesSet] = useState<Set<string | number>>(new Set());
//   const [isLoading, setIsLoading] = useState(true);
//   const [sending, setSending] = useState(false);
//   const [messageText, setMessageText] = useState("");
//   const [isGroupAdmin, setIsGroupAdmin] = useState(false);
//   const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
//   const readSetRef = useRef<Set<number>>(new Set());
//   const [currentUser, setCurrentUser] = useState<{
//     userId: string;
//     fullName: string | null;
//   } | null>(null);
//   const [showMembersModal, setShowMembersModal] = useState(false);
//   const [roomMembers, setRoomMembers] = useState<ChatUser[]>([]);
//   const [appState, setAppState] = useState(AppState.currentState);

//   // Message selection state
//   const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);

//   // Forward modal state
//   const [showForwardModal, setShowForwardModal] = useState(false);

//   const [showPollModal, setShowPollModal] = useState(false);
//   const [activePollId, setActivePollId] = useState<number | null>(null);

//   const [showTableModle, setShowTableModel] = useState(false);
//   const [tableId, setTableId] = useState<number | null>(null);

//   // Media viewer modal states
//   const [showMediaViewer, setShowMediaViewer] = useState(false);
//   const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
//   const [selectedMediaFiles, setSelectedMediaFiles] = useState<any[]>([]);
//   const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

//   // Reply state
//   const [isReplying, setIsReplying] = useState(false);
//   const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

//   // Read status state
//   const [showReadStatus, setShowReadStatus] = useState(false);
//   const [selectedMessageForReadStatus, setSelectedMessageForReadStatus] = useState<Message | null>(null);
//   const [readStatusData, setReadStatusData] = useState<{
//     readBy: Array<{ userId: string, fullName: string, readAt: string }>;
//     unreadBy: Array<{ userId: string, fullName: string }>;
//   } | null>(null);
//   const [isLoadingReadStatus, setIsLoadingReadStatus] = useState(false);

//   // Audio recording state
//   const [showAudioRecorder, setShowAudioRecorder] = useState(false);
//   const [isRecordingAudio, setIsRecordingAudio] = useState(false);

//   // Scheduled messages state
//   const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
//   const [showScheduledMessages, setShowScheduledMessages] = useState(false);

//   // Scroll to bottom state
//   const [showScrollToBottom, setShowScrollToBottom] = useState(false);
//   const [isNearBottom, setIsNearBottom] = useState(true);

//   // Animation refs for each message
//   const messageAnimations = useRef<Map<string | number, Animated.Value>>(new Map());
//   const hapticTriggered = useRef<Map<string | number, boolean>>(new Map());
//   const blinkAnimations = useRef<Map<string | number, Animated.Value>>(new Map());

//   const flatListRef = useRef<FlatList>(null);
//   const navigation = useNavigation();

//   // Helper function to add message to both array and set
//   const addMessage = (message: Message) => {
//     if (!messagesSet.has(message.id)) {
//       setMessagesSet(prev => new Set(prev).add(message.id));
//       setMessages(prev => [...prev, message]);
//     }
//   };

//   // Helper function to remove message from both array and set
//   const removeMessage = (messageId: string | number) => {
//     setMessagesSet(prev => {
//       const newSet = new Set(prev);
//       newSet.delete(messageId);
//       return newSet;
//     });
//     setMessages(prev => prev.filter(msg => msg.id !== messageId));
//   };

//   // Helper function to update message in array
//   const updateMessage = (messageId: string | number, updatedMessage: Message) => {
//     setMessages(prev => prev.map(msg => msg.id === messageId ? updatedMessage : msg));
//   };

//   // Scroll to bottom function
//   const scrollToBottom = () => {
//     if (flatListRef.current && messages.length > 0) {
//       flatListRef.current.scrollToEnd({ animated: true });
//       setShowScrollToBottom(false);
//       setIsNearBottom(true);
//     }
//   };

//   // Handle scroll events
//   const handleScroll = (event: any) => {
//     const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
//     const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;

//     setIsNearBottom(isAtBottom);
//     setShowScrollToBottom(!isAtBottom && messages.length > 10);
//   };

//   // Scroll to specific message with blink effect
//   const scrollToMessage = (messageId: string | number) => {
//     const messageIndex = messages.findIndex(msg => msg.id === messageId);
//     if (messageIndex !== -1 && flatListRef.current) {
//       flatListRef.current.scrollToIndex({
//         index: messageIndex,
//         animated: true,
//         viewPosition: 0.5
//       });

//       // Add blink effect
//       const blinkAnimation = new Animated.Value(0);
//       blinkAnimations.current.set(messageId, blinkAnimation);

//       Animated.sequence([
//         Animated.timing(blinkAnimation, {
//           toValue: 1,
//           duration: 200,
//           useNativeDriver: false,
//         }),
//         Animated.timing(blinkAnimation, {
//           toValue: 0,
//           duration: 200,
//           useNativeDriver: false,
//         }),
//         Animated.timing(blinkAnimation, {
//           toValue: 1,
//           duration: 200,
//           useNativeDriver: false,
//         }),
//         Animated.timing(blinkAnimation, {
//           toValue: 0,
//           duration: 200,
//           useNativeDriver: false,
//         }),
//       ]).start(() => {
//         blinkAnimations.current.delete(messageId);
//       });
//     }
//   };

//   // Handle app state changes (background/foreground)
//   useEffect(() => {
//     const subscription = AppState.addEventListener("change", (nextAppState) => {
//       setAppState(nextAppState);

//       if (appState.match(/inactive|background/) && nextAppState === "active") {
//         loadRoomDetails();

//         // Ensure socket is connected
//         if (!socketService.socket?.connected) {
//           const socket = socketService.connect();
//           if (socket && currentUser && roomId) {
//             socketService.identify(currentUser.userId);
//             socketService.joinRoom(
//               roomId as string,
//               currentUser.userId,
//               currentUser.fullName || "Anonymous"
//             );
//           }
//         }
//       }
//     });

//     return () => {
//       subscription.remove();
//     };
//   }, [appState, currentUser, roomId]);

//   // Connect to socket when component mounts
//   useEffect(() => {
//     socketService.connect();
//   }, []);

//   // Handle Android back button when messages are selected
//   useEffect(() => {
//     const onBackPress = () => {
//       if (selectedMessages.length > 0) {
//         clearSelection();
//         return true; // Prevent default back action
//       }
//       return false; // Allow default back action
//     };

//     const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
//     return () => backHandler.remove();
//   }, [selectedMessages]);

//   // Handle keyboard show/hide events for better scroll positioning
//   useEffect(() => {
//     const keyboardDidShowListener = Keyboard.addListener(
//       'keyboardDidShow',
//       (event) => {
//         // When keyboard shows, scroll to end to ensure last messages are visible
//         setTimeout(() => {
//           if (flatListRef.current && messages.length > 0) {
//             console.log("Keyboard opened, scrolling to end");
//             flatListRef.current.scrollToEnd({ animated: true });
//           }
//         }, 100);
//       }
//     );

//     const keyboardDidHideListener = Keyboard.addListener(
//       'keyboardDidHide',
//       () => {
//         // When keyboard hides, also scroll to end for consistency
//         setTimeout(() => {
//           if (flatListRef.current && messages.length > 0) {
//             console.log("Keyboard closed, scrolling to end");
//             flatListRef.current.scrollToEnd({ animated: true });
//           }
//         }, 100);
//       }
//     );

//     return () => {
//       keyboardDidShowListener?.remove();
//       keyboardDidHideListener?.remove();
//     };
//   }, [messages.length]);

//   // Join room and set up socket event listeners
//   useEffect(() => {
//     if (roomId && currentUser) {
//       // Join the room
//       socketService.joinRoom(
//         roomId as string,
//         currentUser.userId,
//         currentUser.fullName || "Anonymous"
//       );

//       // Listen for online users updates
//       socketService.onOnlineUsers(
//         ({ roomId: updatedRoomId, onlineUsers: users }) => {
//           if (updatedRoomId === roomId) {
//             setOnlineUsers(users.map(String));
//           }
//         }
//       );

//       // Listen for room members updates
//       socketService.onRoomMembers(({ roomId: updatedRoomId, members }) => {
//         if (updatedRoomId === roomId) {
//           setRoomMembers(
//             members.map((m: any) => ({
//               ...m,
//               userId: String(m.userId),
//             }))
//           );
//         }
//       });

//       // Listen for new messages
//       socketService.onNewMessage((data) => {
//         if (data.roomId === roomId) {
//           console.log("New message received:", data);

//           // Only add messages from other users
//           if (data.sender.userId !== currentUser.userId) {
//             // Create the new message
//             const newMessage: Message = {
//               id: data.id,
//               roomId: parseInt(data.roomId),
//               senderId: data.sender.userId,
//               senderName: data.sender.userName,
//               messageText: data.messageText,
//               messageType: data.messageType,
//               createdAt: data.createdAt,
//               mediaFilesId: data?.mediaFilesId,
//               pollId: data?.pollId,
//               tableId: data?.tableId
//             };

//             // Add message using helper function (prevents duplicates)
//             addMessage(newMessage);

//             // Scroll to bottom when new message arrives with proper timing
//             setTimeout(() => {
//               if (flatListRef.current) {
//                 flatListRef.current.scrollToEnd({ animated: true });
//               }
//             }, 200);
//           }
//         }
//       });

//       // Listen for message deletions
//       socketService.onMessagesDeleted((data) => {
//         if (data.roomId === roomId) {
//           console.log("Messages deleted:", data);

//           // Remove deleted messages using helper function
//           data.messageIds.forEach((messageId: string | number) => {
//             removeMessage(messageId);
//           });
//         }
//       });

//       // Listen for message edits
//       socketService.onMessageEdited((data) => {
//         if (data.roomId === roomId) {
//           console.log("Message edited:", data);

//           // Update the edited message using helper function
//           // First get the existing message to preserve other properties
//           const existingMessage = messages.find(msg => msg.id === data.messageId);
//           if (existingMessage) {
//             const updatedMessage = {
//               ...existingMessage,
//               messageText: data.messageText,
//               isEdited: data.isEdited,
//               editedAt: data.editedAt,
//               editedBy: data.editedBy,
//               editorName: data.editorName
//             };
//             updateMessage(data.messageId, updatedMessage);
//           }
//         }
//       });

//       return () => {
//         // Leave the room when component unmounts
//         socketService.leaveRoom(roomId as string, currentUser.userId);
//       };
//     }
//   }, [roomId, currentUser]);

//   useFocusEffect(
//     useCallback(() => {
//       if (roomId) {
//         loadRoomDetails();
//       }
//       return () => {
//         // Clear message selection when navigating away
//         setSelectedMessages([]);
//         // Clear reply state when navigating away
//         setIsReplying(false);
//         setReplyToMessage(null);
//         // Clear active poll state when navigating away
//         setActivePollId(null);
//         setShowPollModal(false);
//       };
//     }, [roomId])
//   );

//   useEffect(() => {
//     if (room) {
//       // Set header options and hide tabs
//       navigation.setOptions({
//         title: room.roomName,
//         tabBarStyle: { display: 'none' }, // Hide tabs
//         headerRight: () =>
//           isGroupAdmin ? ( // Only show room settings icon if user is group admin
//             <TouchableOpacity
//               onPressIn={() => {
//                 console.log("Navigating to room settings with roomId:", roomId);
//                 router.push({
//                   pathname: "/chat/room-info",
//                   params: { roomId },
//                 });
//               }}
//               className="mr-2"
//             >
//               <Ionicons name="settings-outline" size={24} color="#0284c7" />
//             </TouchableOpacity>
//           ) : <></>
//       });
//     } else if (isLoading) {
//       // Show connecting state while loading and hide tabs
//       navigation.setOptions({
//         title: "Connecting...",
//         tabBarStyle: { display: 'none' }, // Hide tabs
//         headerRight: () => <></>
//       });
//     }
//   }, [room, isGroupAdmin, navigation, isLoading]); // Added isLoading dependency

//   // Cleanup effect to restore tabs when leaving the room
//   useEffect(() => {
//     return () => {
//       // Restore tabs when component unmounts
//       navigation.setOptions({
//         tabBarStyle: {
//           borderTopWidth: 1,
//           borderTopColor: '#e5e7eb',
//           height: 60,
//           paddingBottom: 5,
//         }
//       });
//     };
//   }, [navigation]);

//   const loadScheduledMessages = async () => {
//     try {
//       if (!roomId) return;

//       const response = await getScheduledMessages(roomId as string);
//       if (response.success) {
//         setScheduledMessages(response.scheduledMessages);
//       }
//     } catch (error) {
//       console.log("Error loading scheduled messages:", error);
//     }
//   };

//   const loadRoomDetails = async () => {
//     try {
//       setIsLoading(true);

//       // Get current user
//       const userData = await AuthStorage.getUser();
//       console.log("userData in loadRoomDetails", userData);
//       if (userData) {
//         setCurrentUser({
//           userId: userData.userId,
//           fullName: userData.fullName || null
//         });
//       }

//       // Fetch room details
//       const token = await AuthStorage.getToken();
//       const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       setRoom(response.data);
//       const initialMessages = response.data.messages || [];
//       setMessages(initialMessages);
//       setMessagesSet(new Set(initialMessages.map((msg: Message) => msg.id)));

//       // Check if current user is admin of this room (group admin)
//       const isUserGroupAdmin = response.data.members.some(
//         (member: ChatUser) =>
//           member.userId === userData?.userId && member.isAdmin
//       );
//       setIsGroupAdmin(isUserGroupAdmin); // This is specifically for group admin status

//       // Initialize room members with online status
//       const initialMembers = response.data.members.map((member: ChatUser) => ({
//         ...member,
//         userId: String(member.userId),
//         isOnline: false, // Will be updated by socket events
//       }));
//       setRoomMembers(initialMembers);

//       // Join the room via socket after loading details
//       if (userData) {
//         socketService.joinRoom(
//           roomId as string,
//           userData.userId,
//           userData.fullName || "Anonymous"
//         );

//         // Clear notifications for this room when user enters
//         clearRoomNotifications(roomId as string);

//         // Load scheduled messages
//         loadScheduledMessages();
//       }

//       // Scroll to end after messages are loaded (with proper delay for FlatList to mount)
//       setTimeout(() => {
//         if (response.data.messages && response.data.messages.length > 0) {
//           console.log("scrolling to end on load room details");
//           // console.log("FlatList ref:", flatListRef.current);
//           if (flatListRef.current) {
//             flatListRef.current.scrollToEnd({ animated: false });
//           }
//         }
//       }, 500);
//     } catch (error) {
//       console.log("Error loading room details:", error);
//       alert("Failed to load chat room details");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Handle audio recording start
//   const handleAudioRecordingStart = () => {
//     if (!isGroupAdmin) {
//       alert("Only group admins can send audio messages in this room.");
//       return;
//     }
//     setShowAudioRecorder(true);
//     setIsRecordingAudio(true);
//   };

//   // Handle audio recording completion
//   const handleAudioRecordingComplete = async (audioData: {
//     file: string;
//     duration: string;
//     durationMillis: number;
//     waves: any[];
//   }) => {
//     try {
//       setSending(true);
//       console.log("audioData in handleAudioRecordingComplete", audioData);

//       // Upload audio file and get tempFolderId
//       const tempFolderId = await uploadAudioFile(audioData.file);

//       // Send the audio message using vm-media move-to-chat endpoint
//       await sendAudioMessage(tempFolderId, audioData.duration);

//     } catch (error) {
//       console.log("Error sending audio message:", error);
//       alert("Failed to send audio message");
//     } finally {
//       setSending(false);
//       setShowAudioRecorder(false);
//       setIsRecordingAudio(false);
//     }
//   };

//   // Send audio message using vm-media move-to-chat endpoint
//   const sendAudioMessage = async (tempFolderId: string, duration: string) => {
//     try {
//       const token = await AuthStorage.getToken();

//       const response = await axios.post(
//         `${API_URL}/api/vm-media/move-to-chat`,
//         {
//           tempFolderId,
//           roomId,
//           senderId: currentUser?.userId,
//           filesWithCaptions: [{
//             fileName: `audio_${Date.now()}.mp3`,
//             originalName: `Audio message (${duration})`,
//             caption: `Audio message (${duration})`,
//             mimeType: 'audio/mp4', // M4A files use MP4 container format
//             size: 0 // Size will be calculated by backend from the uploaded file
//           }]
//         },
//         {
//           headers: { Authorization: `Bearer ${token}` }
//         }
//       );

//       console.log("Audio message sent:", response.data);

//       if (response.data.success) {
//         // Clear reply state after sending
//         if (isReplying) {
//           setIsReplying(false);
//           setReplyToMessage(null);
//         }

//         // Scroll to bottom after sending
//         setTimeout(() => {
//           if (flatListRef.current) {
//             flatListRef.current.scrollToEnd({ animated: true });
//           }
//         }, 100);
//       } else {
//         throw new Error("Failed to send audio message");
//       }
//     } catch (error) {
//       console.log("Error sending audio message:", error);
//       throw error;
//     }
//   };

//   // Handle audio recording cancellation
//   const handleAudioRecordingCancel = () => {
//     setShowAudioRecorder(false);
//     setIsRecordingAudio(false);
//   };

//   // Upload audio file to get tempFolderId
//   const uploadAudioFile = async (audioUri: string): Promise<string> => {
//     console.log("Uploading audio file to get tempFolderId", audioUri);
//     try {
//       const token = await AuthStorage.getToken();

//       // Read the audio file as base64
//       const base64AudioData = await FileSystem.readAsStringAsync(audioUri, {
//         encoding: FileSystem.EncodingType.Base64,
//       });

//       // Get file info
//       const fileInfo = await FileSystem.getInfoAsync(audioUri);
//       const originalFileName = fileInfo.uri.split('/').pop() || 'audio.m4a';
//       const fileSize = (fileInfo.exists && 'size' in fileInfo) ? fileInfo.size || 0 : 0;

//       // Create a proper filename with timestamp - rename M4A to MP3 for consistency
//       const timestamp = Date.now();
//       const fileName = `audio_${timestamp}.mp3`;

//       console.log("Uploading audio file:", fileName, "Original:", originalFileName, "Size:", fileSize, "Base64 length:", base64AudioData.length);
//       console.log("First 100 chars of base64:", base64AudioData.substring(0, 100));
//       // Upload the file using the correct vm-media endpoint
//       const response = await axios.post(
//         `${API_URL}/api/vm-media/upload`,
//         {
//           files: [{
//             name: fileName,
//             mimeType: 'audio/mp4', // M4A files use MP4 container format
//             fileData: base64AudioData,
//           }]
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             "Content-Type": "application/json",
//           },
//         }
//       );

//       console.log("Upload response:", response.data);

//       if (response.data.success && response.data.tempFolderId) {
//         // For now, we'll use the tempFolderId as a reference
//         // The backend will handle moving it to chat when we send the message
//         return response.data.tempFolderId;
//       } else {
//         throw new Error("Upload failed");
//       }
//     } catch (error) {
//       console.log("Error uploading audio file:", error);
//       throw error;
//     }
//   };

//   const sendMessage = async (
//     text: string,
//     messageType: string,
//     mediaFilesId?: number,
//     pollId?: number,
//     tableId?: number,
//     replyMessageId?: number,
//     scheduledAt?: string
//   ) => {
//     // Only allow group admins to send messages
//     if (!isGroupAdmin) {
//       alert("Only group admins can send messages in this room.");
//       return;
//     }

//     if ((!text.trim() && (!mediaFilesId || !pollId || !tableId)) || !roomId || !currentUser || sending) return;

//     // Trimmed message text
//     const trimmedMessage = text.trim();

//     try {
//       setSending(true);
//       setIsReplying(false);
//       setMessageText(""); // Clear input immediately for better UX

//       // Create optimistic message to show immediately
//       const optimisticMessage: Message = {
//         id: `temp-${Date.now()}`, // Temporary ID
//         roomId: parseInt(roomId as string),
//         senderId: currentUser.userId,
//         senderName: currentUser.fullName || "You",
//         messageText: trimmedMessage,
//         messageType: messageType,
//         createdAt: new Date().toISOString(),
//         mediaFilesId: mediaFilesId,
//         pollId: pollId,
//         tableId: tableId,
//         replyMessageId: replyMessageId,
//         // Add reply information if this is a reply
//         ...(replyMessageId && replyToMessage && {
//           replySenderName: replyToMessage.senderName,
//           replyMessageText: replyToMessage.messageText,
//           replyMessageType: replyToMessage.messageType
//         })
//       };

//       // Add optimistic message using helper function
//       addMessage(optimisticMessage);

//       // Scroll to the bottom immediately for user's own messages
//       setTimeout(() => {
//         if (flatListRef.current) {
//           flatListRef.current.scrollToEnd({ animated: true });
//         }
//       }, 100);

//       // Send the message via API
//       const token = await AuthStorage.getToken();
//       const response = await axios.post(
//         `${API_URL}/api/chat/rooms/${roomId}/messages`,
//         {
//           messageText: trimmedMessage,
//           mediaFilesId: mediaFilesId,
//           pollId: pollId,
//           messageType: messageType,
//           tableId: tableId,
//           replyMessageId: replyMessageId,
//           scheduledAt: scheduledAt
//         },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );

//       // Handle the response - check if it's a scheduled message response
//       if (response.data.success && response.data.scheduledMessage) {
//         // This is a scheduled message response
//         console.log("Message scheduled successfully:", response.data);
//         // Refresh scheduled messages list
//         loadScheduledMessages();
//         return;
//       }

//       // Handle the response which might be a single message or an array of messages
//       const newMessages = Array.isArray(response.data)
//         ? response.data
//         : [response.data];

//       // Add sender name to all messages
//       const messagesWithSenderName = newMessages.map(msg => ({
//         ...msg,
//         senderName: currentUser.fullName || "You",
//       }));

//       // If this is a reply message, add reply information to the message
//       const messagesWithReplyInfo = messagesWithSenderName.map(msg => {
//         if (msg.replyMessageId && replyToMessage) {
//           return {
//             ...msg,
//             replySenderName: replyToMessage.senderName,
//             replyMessageText: replyToMessage.messageText,
//             replyMessageType: replyToMessage.messageType
//           };
//         }
//         return msg;
//       });

//       // Replace optimistic messages with real ones from the server
//       // Remove temp messages and add real ones
//       setMessages((prev) => {
//         const filteredMessages = prev.filter(
//           msg => !(typeof msg.id === 'string' && msg.id.includes('temp'))
//         );
//         return [...filteredMessages, ...messagesWithReplyInfo];
//       });

//       // Update messages set
//       setMessagesSet((prev) => {
//         const newSet = new Set(prev);
//         // Remove temp message IDs
//         Array.from(newSet).forEach(id => {
//           if (typeof id === 'string' && id.includes('temp')) {
//             newSet.delete(id);
//           }
//         });
//         // Add real message IDs
//         messagesWithSenderName.forEach(msg => newSet.add(msg.id));
//         return newSet;
//       });

//       // Ensure scroll position is maintained after server response
//       setTimeout(() => {
//         if (flatListRef.current) {
//           flatListRef.current.scrollToEnd({ animated: false });
//         }
//       }, 150);

//       // Send the messages via socket for real-time delivery
//       messagesWithSenderName.forEach(newMessage => {
//         socketService.sendMessage(roomId as string, newMessage, {
//           userId: currentUser.userId,
//           userName: currentUser.fullName || "Anonymous",
//         });
//       });

//       // Clear reply state after sending
//       if (isReplying) {
//         setIsReplying(false);
//         setReplyToMessage(null);
//       }
//     } catch (error) {
//       console.log("Error sending message:", error);
//       alert("Failed to send message");

//       // Restore the message text if sending failed
//       setMessageText(trimmedMessage);

//       // Remove the optimistic message
//       setMessages((prev) => prev.filter((msg) => typeof msg.id === "number" || (typeof msg.id === 'string' && !msg.id.includes('temp'))));
//       setMessagesSet((prev) => {
//         const newSet = new Set(prev);
//         Array.from(newSet).forEach(id => {
//           if (typeof id === 'string' && id.includes('temp')) {
//             newSet.delete(id);
//           }
//         });
//         return newSet;
//       });
//     } finally {
//       setSending(false);
//     }
//   };

//   // Helper function to handle opening media viewer
//   const openMediaViewer = (mediaId: number) => {
//     console.log("Opening media viewer for media ID:", mediaId);
//     setSelectedMediaId(mediaId);
//     setShowMediaViewer(true);
//   };

//   // Handle media grid press
//   const handleMediaGridPress = (mediaFiles: any[], selectedIndex: number) => {
//     console.log("Opening media viewer for media files:", mediaFiles, "at index:", selectedIndex);
//     setSelectedMediaFiles(mediaFiles);
//     setSelectedMediaIndex(selectedIndex);
//     setShowMediaViewer(true);
//   };

//   // Message selection helper functions
//   const isMessageSelected = (messageId: string | number) => {
//     return selectedMessages.some(msg => msg.id === messageId);
//   };

//   const handleMessageLongPress = (message: Message) => {
//     // Only allow group admins to select messages
//     if (!isGroupAdmin) {
//       return; // Don't allow message selection for non-group admins
//     }

//     if (selectedMessages.length === 0) {
//       // First message selection
//       setSelectedMessages([message]);
//     } else {
//       // Add to existing selection
//       if (!isMessageSelected(message.id)) {
//         setSelectedMessages(prev => [...prev, message]);
//       }
//     }
//   };

//   const handleMessagePress = (message: Message) => {
//     // Only allow group admins to interact with message selection
//     if (!isGroupAdmin) {
//       return; // Don't allow message interaction for non-group admins
//     }

//     if (selectedMessages.length > 0) {
//       // If in selection mode, toggle selection
//       if (isMessageSelected(message.id)) {
//         setSelectedMessages(prev => prev.filter(msg => msg.id !== message.id));
//       } else {
//         setSelectedMessages(prev => [...prev, message]);
//       }
//     }
//   };

//   const clearSelection = () => {
//     setSelectedMessages([]);
//   };

//   // Reply handling functions
//   const handleStartReply = (message: Message) => {
//     setReplyToMessage(message);
//     setIsReplying(true);
//     // Clear any message selection when starting reply
//     setSelectedMessages([]);
//   };

//   // Handle reply preview click - scroll to message and add blink effect
//   const handleReplyPreviewClick = (messageId: string | number) => {
//     // Scroll to the message
//     scrollToMessage(messageId);
//   };

//   const handleCancelReply = () => {
//     setReplyToMessage(null);
//     setIsReplying(false);
//   };

//   // Get or create animation value for a message
//   const getMessageAnimation = (messageId: string | number) => {
//     if (!messageAnimations.current.has(messageId)) {
//       messageAnimations.current.set(messageId, new Animated.Value(0));
//     }
//     return messageAnimations.current.get(messageId)!;
//   };

//   // Swipe gesture handlers
//   const handleGestureBegin = (messageId: string | number) => {
//     const animation = getMessageAnimation(messageId);
//     animation.setValue(0);
//     hapticTriggered.current.set(messageId, false);
//   };

//   const handleGestureUpdate = (event: any, messageId: string | number) => {
//     const { translationX } = event.nativeEvent;
//     const animation = getMessageAnimation(messageId);

//     // Limit the translation to reasonable bounds
//     const maxTranslation = 80;
//     const limitedTranslation = Math.max(-maxTranslation, Math.min(maxTranslation, translationX));

//     animation.setValue(limitedTranslation);

//     // Trigger haptic feedback when threshold is reached (increased threshold for less sensitivity)
//     const threshold = 60; // Increased from 50 to 60
//     if (Math.abs(limitedTranslation) > threshold && !hapticTriggered.current.get(messageId)) {
//       hapticTriggered.current.set(messageId, true);
//       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
//     }
//   };

//   const handleGestureEnd = (event: any, message: Message) => {
//     const { translationX, velocityX } = event.nativeEvent;
//     const animation = getMessageAnimation(message.id);
//     const threshold = 70; // Increased from 50 to 70 for less sensitivity
//     const velocityThreshold = 800; // Increased from 500 to 800 for more intentional swipes

//     if (Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold) {
//       // Trigger reply
//       handleStartReply(message);

//       // Animate back to original position
//       Animated.spring(animation, {
//         toValue: 0,
//         useNativeDriver: true,
//         tension: 300,
//         friction: 20,
//       }).start();
//     } else {
//       // Animate back to original position
//       Animated.spring(animation, {
//         toValue: 0,
//         useNativeDriver: true,
//         tension: 300,
//         friction: 20,
//       }).start();
//     }
//   };

//   // Handle message edit
//   const handleMessageEdited = (editedMessage: Message) => {
//     updateMessage(editedMessage.id, editedMessage);
//   };

//   // Mark message as read (client-side dedupe)
//   const markMessageAsRead = useCallback(async (messageId: string | number) => {
//     if (typeof messageId !== "number") return;
//     if (readSetRef.current.has(messageId)) return;
//     readSetRef.current.add(messageId);
//     try {
//       const token = await AuthStorage.getToken();
//       // const isalreadyread = readStatusData?.readBy.some((item: any) => item.messageId === messageId);
//       // if(isalreadyread){
//       //   return;
//       // }
//       await axios.post(
//         `${API_URL}/api/chat/messages/${messageId}/mark-read`,
//         {},
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//     } catch (error) {
//       console.log('Error marking message as read:', error);
//     }
//   }, []);

//   // Fetch read status for a message
//   const fetchReadStatus = async (messageId: string | number) => {
//     try {
//       setIsLoadingReadStatus(true);
//       const token = await AuthStorage.getToken();
//       const response = await axios.get(
//         `${API_URL}/api/chat/messages/${messageId}/read-status`,
//         { headers: { Authorization: `Bearer ${token}` } }
//       );

//       if (response.data.success) {
//         setReadStatusData(response.data.data);
//       }
//     } catch (error) {
//       console.log('Error fetching read status:', error);
//       alert('Failed to load read status');
//     } finally {
//       setIsLoadingReadStatus(false);
//     }
//   };

//   // Handle info icon press
//   const handleInfoPress = (message: Message) => {
//     setSelectedMessageForReadStatus(message);
//     setShowReadStatus(true);
//     fetchReadStatus(message.id);
//   };

//   // Refresh read status
//   const refreshReadStatus = () => {
//     if (selectedMessageForReadStatus) {
//       fetchReadStatus(selectedMessageForReadStatus.id);
//     }
//   };

//   // Handle viewable items change to mark messages as read
//   const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
//     if (!currentUser) return;

//     viewableItems.forEach((item: any) => {
//       const message = item.item;
//       // Only mark messages as read if they're not from the current user
//       if (message && message.senderId !== currentUser.userId && typeof message.id === 'number') {
//         markMessageAsRead(message.id);
//       }
//     });
//   }, [currentUser, markMessageAsRead]);

//   const viewabilityConfig = {
//     itemVisiblePercentThreshold: 50, // Mark as read when 50% of message is visible
//   };

//   // Forward messages with delay and progress tracking
//   const handleForwardMessages = async (selectedRooms: ChatRoom[], messagesToForward: Message[]) => {
//     const totalOperations = selectedRooms.length * messagesToForward.length;
//     let completedOperations = 0;

//     console.log(`Starting to forward ${messagesToForward.length} messages to ${selectedRooms.length} rooms`);

//     // Process each room and message combination with delay
//     for (const room of selectedRooms) {
//       if (!room.roomId) continue;

//       for (const message of messagesToForward) {
//         try {
//           completedOperations++;
//           console.log(`Forwarding message ${completedOperations}/${totalOperations} to room ${room.roomName}`);

//           // Send message to specific room using API directly
//           const token = await AuthStorage.getToken();
//           const response = await axios.post(
//             `${API_URL}/api/chat/rooms/${room.roomId}/messages`,
//             {
//               messageText: message.messageText || "",
//               mediaFilesId: message.mediaFilesId,
//               pollId: message.pollId,
//               messageType: message.messageType,
//               tableId: message.tableId
//             },
//             { headers: { Authorization: `Bearer ${token}` } }
//           );

//           // Get the created message from response
//           const createdMessage = response.data;

//           // Manually trigger socket sendMessage event to ensure unread counts and room updates work
//           // This mimics what happens in regular messaging
//           if (currentUser && createdMessage) {
//             socketService.sendMessage(room.roomId.toString(), {
//               id: createdMessage.id,
//               roomId: room.roomId,
//               senderId: currentUser.userId,
//               senderName: currentUser.fullName || "You",
//               messageText: message.messageText || "",
//               messageType: message.messageType,
//               createdAt: createdMessage.createdAt,
//               mediaFilesId: message.mediaFilesId,
//               pollId: message.pollId,
//               tableId: message.tableId
//             }, {
//               userId: currentUser.userId,
//               userName: currentUser.fullName || "Anonymous",
//             });
//           }

//           // Add delay between messages to prevent socket issues (1 second as requested)
//           if (completedOperations < totalOperations) {
//             await new Promise(resolve => setTimeout(resolve, 1000));
//           }

//         } catch (error) {
//           console.log(`Error forwarding message to room ${room.roomName}:`, error);
//           throw error; // Re-throw to let the modal handle the error
//         }
//       }
//     }

//     console.log('All messages forwarded successfully');

//     // Clear selection and close forward modal
//     clearSelection();
//     setShowForwardModal(false);
//   };

//   // Delete messages functionality
//   const handleDeleteMessages = async (messageIds: (string | number)[]) => {
//     try {
//       console.log(`Deleting ${messageIds.length} messages`);

//       const token = await AuthStorage.getToken();
//       await axios.delete(`${API_URL}/api/chat/rooms/${roomId}/messages`, {
//         headers: { Authorization: `Bearer ${token}` },
//         data: { messageIds }
//       });

//       console.log('Messages deleted successfully');
//     } catch (error) {
//       console.log('Error deleting messages:', error);
//       throw error; // Re-throw to let the component handle the error
//     }
//   };

//   // Group messages by date
//   const groupMessagesByDate = (messages: Message[]) => {
//     const grouped: { [key: string]: Message[] } = {};

//     messages.forEach(message => {
//       const date = formatISTDate(message.createdAt, {
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric',
//         hour: undefined,
//         minute: undefined,
//         hour12: undefined
//       });
//       if (!grouped[date]) {
//         grouped[date] = [];
//       }
//       grouped[date].push(message);
//     });

//     return grouped;
//   };

//   // Format date for display
//   const formatDateForDisplay = (dateString: string) => {
//     console.log("dateString", dateString);

//     // The dateString is already formatted (e.g., "Oct 2, 2025")
//     // We need to compare it directly with today/yesterday formatted strings

//     // Get current IST date
//     const today = new Date();
//     const yesterday = new Date(today);
//     yesterday.setDate(yesterday.getDate() - 1);

//     // Format dates in IST for comparison
//     const todayIST = formatISTDate(today, {
//       year: 'numeric',
//       month: 'short',
//       day: 'numeric',
//       hour: undefined,
//       minute: undefined,
//       hour12: undefined
//     });
//     const yesterdayIST = formatISTDate(yesterday, {
//       year: 'numeric',
//       month: 'short',
//       day: 'numeric',
//       hour: undefined,
//       minute: undefined,
//       hour12: undefined
//     });

//     // console.log("Comparing:", { dateString, todayIST, yes/terdayIST });

//     if (dateString === todayIST) {
//       return "Today";
//     } else if (dateString === yesterdayIST) {
//       return "Yesterday";
//     } else {
//       return dateString; // Return the already formatted date string
//     }
//   };

//   // Render date separator
//   const renderDateSeparator = (dateString: string) => (
//     <View className="flex-row items-center my-4 px-4">
//       <View className="flex-1 h-px bg-gray-300" />
//       <Text className="mx-3 text-gray-500 text-sm font-medium">
//         {formatDateForDisplay(dateString)}
//       </Text>
//       <View className="flex-1 h-px bg-gray-300" />
//     </View>
//   );

//   // Render message function to support media files
//   const renderMessage = ({ item }: { item: Message }) => {
//     console.log("item got for render", item);
//     const isOwnMessage = item.senderId === currentUser?.userId;
//     const isSelected = isMessageSelected(item.id);
//     const canPerformActions = isOwnMessage && isGroupAdmin; // Only message sender who is group admin can perform actions

//     // Determine message status
//     let messageStatus: "sending" | "sent" | "delivered" | "read" | "error" =
//       "sent";

//     if (typeof item.id === "number") {
//       messageStatus = "delivered"; // For messages with real IDs from the server
//     } else if (typeof item.id === "string") {
//       if (item.id.toString().includes("temp")) {
//         messageStatus = "sending"; // For optimistic messages
//       }
//     }

//     const messageAnimation = getMessageAnimation(item.id);

//     return (
//       <View className="relative">
//         {/* Reply icon background - shows during swipe */}
//         <Animated.View
//           className="absolute top-0 bottom-0 right-4 flex items-center justify-center"
//           style={{
//             opacity: messageAnimation.interpolate({
//               inputRange: [-80, -30, 0],
//               outputRange: [1, 0.5, 0],
//               extrapolate: 'clamp',
//             }),
//           }}
//         >
//           <View className="bg-blue-500 rounded-full p-2">
//             <Ionicons name="arrow-undo" size={20} color="white" />
//           </View>
//         </Animated.View>

//         <Animated.View
//           className="absolute top-0 bottom-0 left-4 flex items-center justify-center"
//           style={{
//             opacity: messageAnimation.interpolate({
//               inputRange: [0, 30, 80],
//               outputRange: [0, 0.5, 1],
//               extrapolate: 'clamp',
//             }),
//           }}
//         >
//           <View className="bg-blue-500 rounded-full p-2">
//             <Ionicons name="arrow-undo" size={20} color="white" />
//           </View>
//         </Animated.View>

//         <PanGestureHandler
//           onBegan={() => handleGestureBegin(item.id)}
//           onGestureEvent={(event) => handleGestureUpdate(event, item.id)}
//           onEnded={(event) => handleGestureEnd(event, item)}
//           onCancelled={(event) => handleGestureEnd(event, item)}
//           onFailed={(event) => handleGestureEnd(event, item)}
//           enabled={!isMessageSelected(item.id)} // Disable swipe when message is selected
//           activeOffsetX={[-20, 20]} // Increased from [-10, 10] to require more movement
//           failOffsetY={[-30, 30]} // Reduced from [-50, 50] to allow slight vertical movement
//           shouldCancelWhenOutside={true}
//           minPointers={1}
//           maxPointers={1}
//         >
//           <Animated.View
//             style={{
//               transform: [{ translateX: messageAnimation }],
//             }}
//           >
//             <Pressable
//               onPress={() => handleMessagePress(item)}
//               onLongPress={() => handleMessageLongPress(item)}
//               delayLongPress={300}
//               className="relative"
//             >
//               {/* Selection overlay - covers full width */}
//               {isSelected && (
//                 <View
//                   className="absolute top-0 bottom-0 left-0 right-0 bg-black"
//                   style={{
//                     backgroundColor: 'rgba(0, 0, 0, 0.15)',
//                     marginLeft: -16,
//                     marginRight: -16,
//                     zIndex: 1
//                   }}
//                 />
//               )}

//               <Animated.View
//                 className={`px-3 py-2 mx-4 my-2 rounded-2xl relative ${isOwnMessage ? "bg-blue-100 ml-16" : "bg-gray-100 mr-16"
//                   }`}
//                 style={{
//                   zIndex: 2,
//                   maxWidth: '85%',
//                   alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
//                   backgroundColor: blinkAnimations.current.get(item.id) ?
//                     blinkAnimations.current.get(item.id)!.interpolate({
//                       inputRange: [0, 1],
//                       outputRange: [isOwnMessage ? '#dbeafe' : '#f3f4f6', '#fbbf24']
//                     }) :
//                     (isOwnMessage ? '#dbeafe' : '#f3f4f6')
//                 }}
//               >
//                 {/* Reply preview - show if this message is replying to another */}
//                 {item.replyMessageId && (
//                   <TouchableOpacity
//                     className={`mb-2 p-2 rounded-lg border-l-2 ${isOwnMessage
//                         ? 'bg-blue-50 border-blue-300'
//                         : 'bg-gray-50 border-gray-400'
//                       }`}
//                     onPress={() => handleReplyPreviewClick(item.replyMessageId!)}
//                   >
//                     <Text className={`text-xs ${isOwnMessage ? 'text-blue-600' : 'text-gray-600'
//                       }`}>
//                       {item.replySenderName}
//                     </Text>
//                     <Text
//                       className={`text-sm ${isOwnMessage ? 'text-blue-800' : 'text-gray-800'
//                         }`}
//                       numberOfLines={1}
//                       ellipsizeMode="tail"
//                     >
//                       {(() => {
//                         if (item.replyMessageType === 'media') {
//                           return '📁 Media Files';
//                         } else if (item.replyMessageType === 'poll') {
//                           return '📊 Poll';
//                         } else if (item.replyMessageType === 'table') {
//                           return '📋 Table';
//                         } else {
//                           return item.replyMessageText || 'Message';
//                         }
//                       })()}
//                     </Text>
//                   </TouchableOpacity>
//                 )}
//                 {!isOwnMessage && (
//                   <Text className="text-xs font-semibold text-blue-600 mb-1">
//                     {item.senderName || "Unknown"}
//                   </Text>
//                 )}

//                 {/* Render announcement message type */}
//                 {item.messageType === 'announcement' ? (
//                   <View
//                     className={`p-3 rounded-lg ${isOwnMessage ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-orange-50 border-l-4 border-orange-500'
//                       }`}
//                   >
//                     {/* Announcement Header */}
//                     <View className="flex-row items-center mb-2">
//                       <Ionicons
//                         name="megaphone"
//                         size={20}
//                         color={isOwnMessage ? '#2563eb' : '#f97316'}
//                       />
//                       <Text className={`ml-2 font-bold text-sm ${isOwnMessage ? 'text-blue-600' : 'text-orange-600'
//                         }`}>
//                         ANNOUNCEMENT
//                       </Text>
//                     </View>

//                     {/* Parse and display title and body */}
//                     {(() => {
//                       const SEPARATOR = "|||ANNOUNCEMENT_SEPARATOR|||";
//                       const parts = item.messageText.split(SEPARATOR);
//                       const title = parts[0] || 'Untitled';
//                       const body = parts[1] || '';

//                       // Custom tag styles for RenderHtml
//                       const tagsStyles = {
//                         body: {
//                           color: '#1f2937',
//                           fontSize: 15,
//                           lineHeight: 22,
//                         },
//                         p: {
//                           marginVertical: 4,
//                         },
//                         h1: {
//                           fontSize: 22,
//                           fontWeight: '600',
//                           marginVertical: 8,
//                         },
//                         h2: {
//                           fontSize: 20,
//                           fontWeight: '600',
//                           marginVertical: 6,
//                         },
//                         h3: {
//                           fontSize: 18,
//                           fontWeight: '600',
//                           marginVertical: 4,
//                         },
//                         ul: {
//                           marginVertical: 4,
//                           paddingLeft: 20,
//                         },
//                         ol: {
//                           marginVertical: 4,
//                           paddingLeft: 20,
//                         },
//                         li: {
//                           marginVertical: 2,
//                         },
//                         a: {
//                           color: '#2563eb',
//                           textDecorationLine: 'underline',
//                         },
//                         blockquote: {
//                           borderLeftWidth: 3,
//                           borderLeftColor: '#d1d5db',
//                           paddingLeft: 12,
//                           marginVertical: 8,
//                           color: '#6b7280',
//                         },
//                         pre: {
//                           backgroundColor: '#f3f4f6',
//                           padding: 12,
//                           borderRadius: 4,
//                           marginVertical: 8,
//                         },
//                         code: {
//                           backgroundColor: '#f3f4f6',
//                           paddingHorizontal: 6,
//                           paddingVertical: 2,
//                           borderRadius: 4,
//                           fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
//                           fontSize: 13,
//                         },
//                         img: {
//                           maxWidth: '100%',
//                         },
//                         table: {
//                           borderWidth: 1,
//                           borderColor: '#d1d5db',
//                         },
//                         th: {
//                           backgroundColor: '#f3f4f6',
//                           padding: 8,
//                           borderWidth: 1,
//                           borderColor: '#d1d5db',
//                         },
//                         td: {
//                           padding: 8,
//                           borderWidth: 1,
//                           borderColor: '#d1d5db',
//                         },
//                         strong: {
//                           fontWeight: '600',
//                         },
//                         em: {
//                           fontStyle: 'italic',
//                         },
//                         u: {
//                           textDecorationLine: 'underline',
//                         },
//                         s: {
//                           textDecorationLine: 'line-through',
//                         },
//                       };

//                       // Calculate content width (accounting for padding)
//                       const contentWidth = screenWidth - 100; // Adjust based on your layout

//                       return (
//                         <>
//                           {/* Title */}
//                           <Text className={`text-lg font-bold mb-2 ${isOwnMessage ? 'text-blue-900' : 'text-gray-900'
//                             }`}>
//                             {title}
//                           </Text>

//                           {/* Body - Render HTML using react-native-render-html */}
//                           {body && body.trim() !== '' && body !== '<p></p>' && body !== '<p><br></p>' && (
//                             <View
//                               className="mb-2 p-2 rounded-lg"
//                               style={{
//                                 backgroundColor: isOwnMessage ? '#eff6ff' : '#fff7ed',
//                               }}
//                             >
//                               <RenderHtml
//                                 contentWidth={contentWidth}
//                                 source={{ html: body }}
//                                 tagsStyles={tagsStyles}
//                                 enableExperimentalMarginCollapsing={true}
//                                 enableExperimentalBRCollapsing={true}
//                                 defaultTextProps={{
//                                   selectable: true,
//                                 }}
//                                 renderersProps={{
//                                   img: {
//                                     enableExperimentalPercentWidth: true,
//                                   },
//                                 }}
//                               />
//                             </View>
//                           )}
//                         </>
//                       );
//                     })()}
//                   </View>
//                 ) : item.messageText ? (
//                   <View>
//                     <Text className={`text-base leading-5 ${isOwnMessage ? "text-gray-900" : "text-gray-800"
//                       }`}>
//                       {(item.messageText)}
//                     </Text>
//                   </View>
//                 ) : null}

//                 {/* Render audio messages */}
//                 {item.mediaFilesId && item.messageType === 'audio' ? (
//                   <View className="mt-1">
//                     <AudioMessagePlayer
//                       audioUrl={`${API_URL}/media/chat/${item.mediaFilesId}`}
//                       duration={item.messageText?.includes('(') ? item.messageText.match(/\(([^)]+)\)/)?.[1] : undefined}
//                       isOwn={isOwnMessage}
//                       waves={[]} // TODO: Store and retrieve wave data
//                     />
//                   </View>
//                 ) : item.mediaFilesId ? (
//                   <View className="mt-2">
//                     <MediaGrid
//                       mediaFilesId={item.mediaFilesId}
//                       messageId={item.id}
//                       onMediaPress={handleMediaGridPress}
//                       isOwnMessage={isOwnMessage}
//                       isLoading={false} // You can add loading state management here
//                     />
//                   </View>
//                 ) : null}

//                 {/* Render table if present */}
//                 {item.tableId ? (
//                   <TouchableOpacity
//                     onPress={() => {
//                       if (typeof item.tableId === 'number') {
//                         setTableId(item.tableId);
//                         setShowTableModel(true);
//                       }
//                     }}
//                     className={`p-2 rounded-lg mt-1 ${isOwnMessage ? 'bg-blue-200' : 'bg-gray-200'
//                       }`}
//                   >
//                     <Text className={`font-semibold ${isOwnMessage ? 'text-blue-800' : 'text-gray-700'
//                       }`}>📊 Table</Text>
//                     <Text className={`text-xs ${isOwnMessage ? 'text-blue-600' : 'text-gray-600'
//                       }`}>Tap to view table</Text>
//                   </TouchableOpacity>
//                 ) : null}

//                 {showTableModle && tableId !== null && currentUser?.userId && (
//                   <RenderTable
//                     tableId={tableId}
//                     visible={showTableModle}
//                     setShowTable={setShowTableModel}
//                   />
//                 )}

//                 {/* Render poll if present */}
//                 {item.pollId ? (
//                   <TouchableOpacity
//                     onPress={() => {
//                       if (typeof item.pollId === 'number') {
//                         // Only allow one poll to be active at a time
//                         if (!showPollModal) {
//                           setActivePollId(item.pollId);
//                           setShowPollModal(true);
//                         }
//                       }
//                     }}
//                     disabled={showPollModal && activePollId !== item.pollId}
//                     className={`p-3 rounded-lg mt-1 ${showPollModal && activePollId !== item.pollId
//                         ? 'bg-gray-200 opacity-50'
//                         : isOwnMessage ? 'bg-blue-200' : 'bg-gray-200'
//                       }`}
//                   >
//                     <Text className={`font-semibold ${showPollModal && activePollId !== item.pollId
//                         ? 'text-gray-500'
//                         : isOwnMessage ? 'text-blue-800' : 'text-gray-700'
//                       }`}>
//                       📊 Poll
//                     </Text>
//                     <Text className={`text-xs ${showPollModal && activePollId !== item.pollId
//                         ? 'text-gray-400'
//                         : isOwnMessage ? 'text-blue-600' : 'text-gray-600'
//                       }`}>
//                       {showPollModal && activePollId !== item.pollId
//                         ? 'Another poll is active'
//                         : 'Tap to vote'
//                       }
//                     </Text>
//                   </TouchableOpacity>
//                 ) : null}

//                 {/* Time and status - aligned to right */}
//                 <View className="flex-row justify-end items-center mt-1">
//                   <Text
//                     className={`text-xs ${isOwnMessage ? "text-gray-600" : "text-gray-500"
//                       }`}
//                   >
//                     {formatISTTime(item.editedAt || "")}
//                   </Text>
//                   {isOwnMessage && (
//                     <View className="ml-1">
//                       <MessageStatus status={messageStatus} />
//                     </View>
//                   )}
//                   {/* Show edit indicator only once */}
//                   {item.isEdited && (
//                     <Text className={`text-xs italic ml-1 ${isOwnMessage ? "text-gray-600" : "text-gray-500"
//                       }`}>
//                       edited
//                     </Text>
//                   )}
//                 </View>
//               </Animated.View>
//             </Pressable>
//           </Animated.View>
//         </PanGestureHandler>
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

//   if (!room) {
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
//     <GestureHandlerRootView className="flex-1">
//       <SafeAreaView className="flex-1 bg-white">
//         <KeyboardAvoidingView
//           behavior={Platform.OS === "ios" ? "padding" : "height"}
//           className="flex-1"
//           keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
//         >
//           {/* Conditional header: Show ChatMessageOptions when messages are selected AND user is group admin */}
//           {selectedMessages.length > 0 && isGroupAdmin ? (
//             <ChatMessageOptions
//               selectedMessages={selectedMessages}
//               setSelectedMessages={setSelectedMessages}
//               isAdmin={isGroupAdmin} // Pass group admin status
//               onClose={clearSelection}
//               onForwardPress={() => setShowForwardModal(true)}
//               onDeletePress={handleDeleteMessages}
//               onInfoPress={handleInfoPress}
//               roomId={Array.isArray(roomId) ? roomId[0] : roomId}
//               roomMembers={roomMembers}
//               currentUser={currentUser}
//               onMessageEdited={handleMessageEdited}
//             />
//           ) : (
//             <OnlineUsersIndicator
//               onlineCount={onlineUsers.length}
//               totalCount={roomMembers.length}
//               onPress={() => setShowMembersModal(true)}
//             />
//           )}

//           {/* Messages list */}
//           <FlatList
//             ref={flatListRef}
//             data={(() => {
//               // Sort messages by timestamp first (oldest to newest)
//               const sortedMessages = [...messages].sort((a, b) =>
//                 new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
//               );


//               // Group sorted messages by date
//               const grouped = groupMessagesByDate(sortedMessages);

//               // Get date keys and sort them chronologically
//               const dateKeys = Object.keys(grouped);
//               const sortedDateKeys = dateKeys.sort((a, b) => {
//                 // Get the first message from each date group to determine chronological order
//                 const firstMessageA = grouped[a][0];
//                 const firstMessageB = grouped[b][0];
//                 return new Date(firstMessageA.createdAt).getTime() - new Date(firstMessageB.createdAt).getTime();
//               });

//               const flatData: (Message | { type: 'date', date: string })[] = [];

//               sortedDateKeys.forEach(date => {
//                 flatData.push({ type: 'date', date } as any);
//                 flatData.push(...grouped[date]);
//               });

//               return flatData;
//             })()}
//             keyExtractor={(item, index) =>
//               item.type === 'date' ? `date-${item.date}` : item.id.toString()
//             }
//             renderItem={({ item }) => {
//               if (item.type === 'date') {
//                 return renderDateSeparator(item.date);
//               }
//               console.log("rendering", item);
//               return renderMessage({ item: item as Message });
//             }}
//             contentContainerStyle={{ paddingVertical: 10 }}
//             onScroll={handleScroll}
//             scrollEventThrottle={16}
//             onViewableItemsChanged={onViewableItemsChanged}
//             viewabilityConfig={viewabilityConfig}
//             onLayout={() => {
//               // Ensure scroll to end after FlatList is laid out
//               setTimeout(() => {
//                 if (flatListRef.current && messages.length > 0) {
//                   // console.log("FlatList onLayout - scrolling to end");
//                   flatListRef.current.scrollToEnd({ animated: false });
//                 }
//               }, 100);
//             }}
//             onContentSizeChange={() => {
//               // Scroll to end when content size changes (new messages) only if near bottom
//               if (isNearBottom) {
//                 setTimeout(() => {
//                   if (flatListRef.current && messages.length > 0) {
//                     // console.log("FlatList content size changed - scrolling to end");
//                     flatListRef.current.scrollToEnd({ animated: true });
//                   }
//                 }, 100);
//               }
//             }}
//             ListEmptyComponent={
//               <View className="flex-1 justify-center items-center p-4 mt-10">
//                 <Ionicons name="chatbubble-outline" size={60} color="#d1d5db" />
//                 <Text className="text-gray-500 mt-4 text-center">
//                   No messages yet. {isGroupAdmin ? "Be the first to send a message!" : "Only group admins can send messages in this room."}
//                 </Text>
//               </View>
//             }
//           />

//           {/* Scroll to bottom button */}
//           {showScrollToBottom && (
//             <TouchableOpacity
//               onPress={scrollToBottom}
//               className="absolute bottom-20 right-4 bg-blue-500 rounded-full p-3 shadow-lg"
//               style={{ zIndex: 1000 }}
//             >
//               <Ionicons name="arrow-down" size={20} color="white" />
//             </TouchableOpacity>
//           )}

//           {/* Reply preview - show above message input when replying */}
//           {isReplying && replyToMessage && (isGroupAdmin || replyToMessage.senderId === currentUser?.userId) && (
//             <View className="bg-gray-100 border-t border-gray-200 px-4 py-3">
//               <View className="flex-row items-center justify-between">
//                 <View className="flex-1">
//                   <View className="flex-row items-center mb-1">
//                     <Ionicons name="arrow-undo" size={16} color="#6b7280" />
//                     <Text className="text-sm text-gray-600 ml-2">
//                       Replying to {replyToMessage.senderName}
//                     </Text>
//                   </View>
//                   <Text
//                     className="text-sm text-gray-800 bg-white px-3 py-2 rounded-lg"
//                     numberOfLines={2}
//                     ellipsizeMode="tail"
//                   >
//                     {replyToMessage.messageText}
//                   </Text>
//                 </View>
//                 <TouchableOpacity
//                   onPress={handleCancelReply}
//                   className="ml-3 p-2"
//                 >
//                   <Ionicons name="close" size={20} color="#6b7280" />
//                 </TouchableOpacity>
//               </View>
//             </View>
//           )}

//           {/* Message input - Only show for group admins */}
//           {isGroupAdmin && (
//             <View className="px-4 py-2 bg-white border-t border-gray-200">
//               <MessageInput
//                 messageText={messageText}
//                 onChangeText={setMessageText}
//                 onSend={(text: string, messageType: string, scheduledAt?: string) => {
//                   if (messageType === "audio") {
//                     handleAudioRecordingStart();
//                   } else {
//                     sendMessage(text, messageType, undefined, undefined, undefined, replyToMessage?.id as number, scheduledAt);
//                   }
//                 }}
//                 sending={sending}
//                 disabled={false}
//                 roomMembers={roomMembers}
//                 currentUser={currentUser}
//                 roomId={roomId as string}
//                 showAttachments={true}
//                 onAudioRecord={handleAudioRecordingStart}
//                 onScheduleMessage={() => setShowScheduledMessages(true)}
//                 hasScheduledMessages={scheduledMessages.length > 0}
//                 onFocus={() => {
//                   // When input is focused, scroll to end to ensure last messages are visible
//                   setTimeout(() => {
//                     if (flatListRef.current && messages.length > 0) {
//                       console.log("MessageInput focused - scrolling to end");
//                       flatListRef.current.scrollToEnd({ animated: true });
//                     }
//                   }, 300);
//                 }}
//                 style={{
//                   borderTopWidth: 0,
//                   borderTopColor: 'transparent',
//                   backgroundColor: 'transparent',
//                   paddingHorizontal: 0
//                 }}
//               />
//             </View>
//           )}

//           {/* Non-admin message - Show for non-group admins */}
//           {!isGroupAdmin && (
//             <View className="p-4 border-t border-gray-200 bg-gray-50">
//               <Text className="text-center text-gray-600 text-sm">
//                 Only group admins can send messages in this room
//               </Text>
//             </View>
//           )}

//           {/* Members Modal to show who are currently online in this room */}
//           <MembersModal
//             visible={showMembersModal}
//             onClose={() => setShowMembersModal(false)}
//             members={roomMembers.map((member) => ({
//               userId: member.userId,
//               fullName: member.fullName || "Unknown User",
//               isAdmin: Boolean(member.isAdmin),
//               isOnline: Boolean(member.isOnline),
//             }))}
//             currentUserId={currentUser?.userId || ""}
//           />

//           {/* Media Viewer Modal */}
//           {showMediaViewer && (
//             <MediaViewerModal
//               visible={showMediaViewer}
//               onClose={() => {
//                 setShowMediaViewer(false);
//                 setSelectedMediaId(null);
//                 setSelectedMediaFiles([]);
//                 setSelectedMediaIndex(0);
//               }}
//               mediaId={selectedMediaId || undefined}
//               mediaFiles={selectedMediaFiles}
//               initialIndex={selectedMediaIndex}
//             />
//           )}

//           {/* Forward Messages Modal - Only show for group admins */}
//           {isGroupAdmin && (
//             <ForwardMessagesModal
//               visible={showForwardModal}
//               onClose={() => setShowForwardModal(false)}
//               selectedMessages={selectedMessages}
//               currentRoomId={roomId as string}
//               onForward={handleForwardMessages}
//             />
//           )}

//           {/* Global Poll Modal - Single instance for all polls */}
//           <GlobalPollModal
//             pollId={activePollId}
//             visible={showPollModal}
//             onClose={() => {
//               setShowPollModal(false);
//               setActivePollId(null);
//             }}
//             currentUserId={currentUser?.userId || ""}
//             totalMembers={roomMembers.length}
//           />

//           {/* Read Status Modal */}
//           <Modal
//             visible={showReadStatus}
//             animationType="slide"
//             transparent={false}
//             onRequestClose={() => setShowReadStatus(false)}
//           >
//             <SafeAreaView className="flex-1 bg-white">
//               <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
//                 <TouchableOpacity
//                   onPress={() => setShowReadStatus(false)}
//                   className="p-2"
//                 >
//                   <Ionicons name="arrow-back" size={24} color="#374151" />
//                 </TouchableOpacity>

//                 <Text className="text-lg font-semibold text-gray-900">Message Info</Text>

//                 <TouchableOpacity
//                   onPress={refreshReadStatus}
//                   disabled={isLoadingReadStatus}
//                   className="p-2"
//                 >
//                   <Ionicons
//                     name="refresh"
//                     size={24}
//                     color={isLoadingReadStatus ? "#9ca3af" : "#374151"}
//                   />
//                 </TouchableOpacity>
//               </View>

//               <ScrollView className="flex-1 px-4 py-4">
//                 {/* Message Preview */}
//                 {selectedMessageForReadStatus && (
//                   <View className="mb-6 p-4 bg-gray-50 rounded-lg">
//                     <Text className="text-sm text-gray-600 mb-2">
//                       {selectedMessageForReadStatus.senderName} • {formatISTDate(selectedMessageForReadStatus.createdAt)}
//                     </Text>
//                     <Text className="text-base text-gray-900" numberOfLines={3}>
//                       {selectedMessageForReadStatus.messageText}
//                     </Text>
//                   </View>
//                 )}

//                 {/* Read Status */}
//                 {isLoadingReadStatus ? (
//                   <View className="items-center py-8">
//                     <ActivityIndicator size="large" color="#0284c7" />
//                     <Text className="text-gray-500 mt-2">Loading read status...</Text>
//                   </View>
//                 ) : readStatusData ? (
//                   <View>
//                     {/* Read by section */}
//                     {readStatusData.readBy.length > 0 && (
//                       <View className="mb-6">
//                         <Text className="text-lg font-semibold text-gray-900 mb-3">
//                           Read by ({readStatusData.readBy.length})
//                         </Text>
//                         {readStatusData.readBy.map((user, index) => (
//                           <View key={index} className="flex-row items-center justify-between py-2 border-b border-gray-100">
//                             <Text className="text-gray-900">{user.fullName}</Text>
//                             <Text className="text-sm text-gray-500">
//                               {formatISTDate(user.readAt)}
//                             </Text>
//                           </View>
//                         ))}
//                       </View>
//                     )}

//                     {/* Unread by section */}
//                     {readStatusData.unreadBy.length > 0 && (
//                       <View>
//                         <Text className="text-lg font-semibold text-gray-900 mb-3">
//                           Unread by ({readStatusData.unreadBy.length})
//                         </Text>
//                         {readStatusData.unreadBy.map((user, index) => (
//                           <View key={index} className="flex-row items-center py-2 border-b border-gray-100">
//                             <Text className="text-gray-500">{user.fullName}</Text>
//                           </View>
//                         ))}
//                       </View>
//                     )}

//                     {readStatusData.readBy.length === 0 && readStatusData.unreadBy.length === 0 && (
//                       <View className="items-center py-8">
//                         <Ionicons name="information-circle-outline" size={48} color="#d1d5db" />
//                         <Text className="text-gray-500 mt-2">No read status available</Text>
//                       </View>
//                     )}
//                   </View>
//                 ) : (
//                   <View className="items-center py-8">
//                     <Text className="text-gray-500">Failed to load read status</Text>
//                   </View>
//                 )}
//               </ScrollView>
//             </SafeAreaView>
//           </Modal>

//           {/* Audio Recorder */}
//           <AudioRecorder
//             isVisible={showAudioRecorder}
//             onRecordingComplete={handleAudioRecordingComplete}
//             onCancel={handleAudioRecordingCancel}
//           />

//           {/* Scheduled Messages Modal */}
//           <Modal
//             visible={showScheduledMessages}
//             animationType="slide"
//             transparent={false}
//             onRequestClose={() => setShowScheduledMessages(false)}
//           >
//             <SafeAreaView className="flex-1 bg-white">
//               <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
//                 <TouchableOpacity
//                   onPress={() => setShowScheduledMessages(false)}
//                   className="p-2"
//                 >
//                   <Ionicons name="arrow-back" size={24} color="#374151" />
//                 </TouchableOpacity>

//                 <Text className="text-lg font-semibold text-gray-900">Scheduled Messages</Text>

//                 <TouchableOpacity
//                   onPress={loadScheduledMessages}
//                   className="p-2"
//                 >
//                   <Ionicons name="refresh" size={24} color="#374151" />
//                 </TouchableOpacity>
//               </View>

//               <ScrollView className="flex-1 px-4 py-4">
//                 {scheduledMessages.length === 0 ? (
//                   <View className="flex-1 justify-center items-center py-8">
//                     <Ionicons name="time-outline" size={60} color="#d1d5db" />
//                     <Text className="text-gray-500 mt-4 text-center">
//                       No scheduled messages
//                     </Text>
//                   </View>
//                 ) : (
//                   scheduledMessages.map((message, index) => (
//                     <View key={index} className="mb-4 p-4 bg-gray-50 rounded-lg">
//                       <View className="flex-row items-center justify-between mb-2">
//                         <Text className="text-sm text-gray-600">
//                           {message.senderName}
//                         </Text>
//                         <Text className="text-sm text-gray-500">
//                           {formatISTDate(message.createdAt)}
//                         </Text>
//                       </View>
//                       <Text className="text-base text-gray-900 mb-2">
//                         {message.messageText}
//                       </Text>
//                       <View className="flex-row items-center">
//                         <Ionicons name="time-outline" size={16} color="#6b7280" />
//                         <Text className="text-sm text-gray-600 ml-1">
//                           Scheduled for {formatISTDate(message.createdAt)}
//                         </Text>
//                       </View>
//                     </View>
//                   ))
//                 )}
//               </ScrollView>
//             </SafeAreaView>
//           </Modal>
//         </KeyboardAvoidingView>
//       </SafeAreaView>
//     </GestureHandlerRootView>
//   );
// }


// app/chat/[roomId].tsx - Updated with Inverted FlatList

import * as React from 'react';
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  AppState,
  Pressable,
  BackHandler,
  Keyboard,
  ScrollView,
  Animated,
  Modal,
  StyleSheet,
  ToastAndroid,
} from "react-native";
import {
  PanGestureHandler,
  GestureHandlerRootView
} from 'react-native-gesture-handler';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import { MessageStorage } from "@/utils/messageStorage";
import { Message, ChatRoom, ChatUser } from "@/types/type";
import { getISTTimestamp, formatISTTime, formatISTDate, isSameDayIST, getRelativeTimeIST } from "@/utils/dateUtils";
import axios from "axios";
import * as FileSystem from 'expo-file-system';
import { API_URL } from "@/constants/api";
import { useFocusEffect } from "@react-navigation/native";
import socketService from "@/utils/socketService";
import OnlineUsersIndicator from "@/components/chat/OnlineUsersIndicator";
import MembersModal from "@/components/chat/MembersModal";
import MessageStatus from "@/components/chat/MessageStatus";
import GlobalPollModal from "@/components/chat/GlobalPollModal";
import RenderTable from "@/components/chat/Attechments/RenderTable";
import MediaViewerModal from "@/components/chat/MediaViewerModal";
import ChatMessageOptions from "@/components/chat/ChatMessageOptions";
import ForwardMessagesModal from "@/components/chat/ForwardMessagesModal";
import MessageInput from "@/components/chat/MessageInput";
import AudioRecorder from "@/components/chat/AudioRecorder";
import AudioMessagePlayer from "@/components/chat/AudioMessagePlayer";
import MediaGrid from "@/components/chat/MediaGrid";
import WebView from 'react-native-webview';
import { clearRoomNotifications } from "@/utils/chatNotificationHandler";
import { getScheduledMessages } from "@/api/chat";
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { logout } from '@/api/auth';

interface RoomDetails extends ChatRoom {
  members: ChatUser[];
  messages: Message[];
}

// Type for FlatList items (messages and date separators)
type ChatListItem =
  | (Message & { itemType: 'message' })
  | { itemType: 'dateSeparator'; date: string; id: string };

// Memoized Date Separator Component
const DateSeparator = React.memo(({ dateString, formatDateForDisplay }: {
  dateString: string;
  formatDateForDisplay: (date: string) => string;
}) => (
  <View style={styles.dateSeparatorContainer}>
    <View style={styles.dateSeparatorPill}>
      <Text style={styles.dateSeparatorText}>
        {formatDateForDisplay(dateString)}
      </Text>
    </View>
  </View>
));

// Memoized Message Bubble Component
const MessageBubble = React.memo(({
  item,
  isOwnMessage,
  isSelected,
  currentUser,
  onPress,
  onLongPress,
  onReplyPreviewClick,
  formatTime,
  messageAnimation,
  blinkAnimation,
}: {
  item: Message;
  isOwnMessage: boolean;
  isSelected: boolean;
  currentUser: { userId: string; fullName: string | null } | null;
  onPress: () => void;
  onLongPress: () => void;
  onReplyPreviewClick: (id: string | number) => void;
  formatTime: (date: string) => string;
  messageAnimation: Animated.Value;
  blinkAnimation?: Animated.Value;
}) => {
  let messageStatus: "sending" | "sent" | "delivered" | "read" | "error" = "sent";
  if (typeof item.id === "number") {
    messageStatus = "delivered";
  } else if (typeof item.id === "string" && item.id.includes("temp")) {
    messageStatus = "sending";
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
    >
      {isSelected && (
        <View style={styles.selectedOverlay} />
      )}

      <Animated.View
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble,
          {
            backgroundColor: blinkAnimation ?
              blinkAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [isOwnMessage ? '#DCF8C6' : '#FFFFFF', '#fbbf24']
              }) :
              (isOwnMessage ? '#DCF8C6' : '#FFFFFF')
          }
        ]}
      >
        {/* Reply preview */}
        {item.replyMessageId && (
          <TouchableOpacity
            style={[
              styles.replyPreview,
              isOwnMessage ? styles.ownReplyPreview : styles.otherReplyPreview
            ]}
            onPress={() => onReplyPreviewClick(item.replyMessageId!)}
          >
            <Text style={styles.replyName}>{item.replySenderName}</Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {item.replyMessageText || 'Message'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Sender name for received messages */}
        {!isOwnMessage && (
          <Text style={styles.senderName}>
            {item.senderName || "Unknown"}
          </Text>
        )}

        {/* Message text */}
        {item.messageText && (
          <Text style={styles.messageText}>
            {item.messageText}
          </Text>
        )}

        {/* Time and status row */}
        <View style={styles.metaRow}>
          {item.isEdited && (
            <Text style={styles.editedLabel}>edited</Text>
          )}
          <Text style={styles.timeText}>
            {formatTime(item.createdAt || "")}
          </Text>
          {isOwnMessage && (
            <View style={styles.statusContainer}>
              <MessageStatus status={messageStatus} />
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.messageText === nextProps.item.messageText &&
    prevProps.item.isEdited === nextProps.item.isEdited &&
    prevProps.item.editedAt === nextProps.item.editedAt &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.isSelected === nextProps.isSelected
  );
});

// Telegram-style Header Component (add before ChatRoomScreen)
const TelegramHeader = React.memo(({
  roomName,
  memberCount,
  onlineCount,
  onBackPress,
  onAvatarPress,
  onMenuPress,
  isSyncing,
}: {
  roomName: string;
  memberCount: number;
  onlineCount: number;
  onBackPress: () => void;
  onAvatarPress: () => void;
  onMenuPress?: () => void;
  isSyncing: boolean;
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusText = () => {
    if (onlineCount > 0) {
      return `${memberCount} members, ${onlineCount} online`;
    }
    return `${memberCount} members`;
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      <TouchableOpacity onPress={onAvatarPress} style={styles.headerContent}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(roomName)}</Text>
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.roomName} numberOfLines={1}>
            {roomName}
          </Text>
          <View style={styles.statusRow}>
            {isSyncing ? (
              <Text style={styles.statusText}>updating...</Text>
            ) : (
              <Text style={styles.statusText}>{getStatusText()}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {onMenuPress && (
        <TouchableOpacity onPress={onMenuPress} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color="#000" />
        </TouchableOpacity>
      )}
    </View>
  );
});
const styles = StyleSheet.create({
  // Date Separator Styles
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dateSeparatorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },

  // Message Bubble Styles
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ownBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 4,
    marginLeft: 60,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    marginRight: 60,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 136, 204, 0.15)',
    marginHorizontal: -16,
  },

  // Reply Preview Styles
  replyPreview: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  ownReplyPreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderLeftColor: '#4CAF50',
  },
  otherReplyPreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderLeftColor: '#0088CC',
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0088CC',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: '#666',
  },

  // Sender Name Style
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0088CC',
    marginBottom: 2,
  },

  // Message Text Style
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000',
  },

  // Meta Row Styles
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  editedLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  statusContainer: {
    marginLeft: 2,
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0088CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  roomName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  statusText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  menuButton: {
    padding: 8,
  },

  // Input Bar Styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 120,
  },
  textInput: {
    fontSize: 16,
    color: '#000',
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0088CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Chat Container Styles
  chatContainer: {
    flex: 1,
    backgroundColor: '#E5DDD5',
  },
  listContent: {
    paddingVertical: 8,
  },
});
export default function ChatRoomScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { roomId } = useLocalSearchParams();
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesSet, setMessagesSet] = useState<Set<string | number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const readSetRef = useRef<Set<number>>(new Set());
  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    fullName: string | null;
  } | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<ChatUser[]>([]);
  const [appState, setAppState] = useState(AppState.currentState);

  // Message selection state
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);

  // Forward modal state
  const [showForwardModal, setShowForwardModal] = useState(false);

  const [showPollModal, setShowPollModal] = useState(false);
  const [activePollId, setActivePollId] = useState<number | null>(null);

  const [showTableModle, setShowTableModel] = useState(false);
  const [tableId, setTableId] = useState<number | null>(null);

  // Media viewer modal states
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<any[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  // Reply state
  const [isReplying, setIsReplying] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  // Read status state
  const [showReadStatus, setShowReadStatus] = useState(false);
  const [selectedMessageForReadStatus, setSelectedMessageForReadStatus] = useState<Message | null>(null);
  const [readStatusData, setReadStatusData] = useState<{
    readBy: Array<{ userId: string, fullName: string, readAt: string }>;
    unreadBy: Array<{ userId: string, fullName: string }>;
  } | null>(null);
  const [isLoadingReadStatus, setIsLoadingReadStatus] = useState(false);

  // Audio recording state
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  // Scheduled messages state
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [showScheduledMessages, setShowScheduledMessages] = useState(false);

  // Scroll state for inverted list
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Cache state
  const [isFromCache, setIsFromCache] = useState(false);
  const isInitialLoad = useRef(true);

  // Animation refs for each message
  const messageAnimations = useRef<Map<string | number, Animated.Value>>(new Map());
  const hapticTriggered = useRef<Map<string | number, boolean>>(new Map());
  const blinkAnimations = useRef<Map<string | number, Animated.Value>>(new Map());

  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // Prepare data for inverted FlatList
  // Prepare data for inverted FlatList with itemType to prevent re-renders
  const preparedListData = useMemo((): ChatListItem[] => {
    if (messages.length === 0) return [];

    // Sort messages by timestamp (oldest to newest first for grouping)
    const sortedMessages = [...messages].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Group messages by date
    const grouped: { [key: string]: Message[] } = {};
    sortedMessages.forEach(message => {
      const date = formatISTDate(message.createdAt, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: undefined,
        minute: undefined,
        hour12: undefined
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(message);
    });

    // Build the list data for inverted FlatList
    const listData: ChatListItem[] = [];
    const dateKeys = Object.keys(grouped).sort((a, b) => {
      const firstMessageA = grouped[a][0];
      const firstMessageB = grouped[b][0];
      return new Date(firstMessageB.createdAt).getTime() - new Date(firstMessageA.createdAt).getTime();
    });

    dateKeys.forEach(date => {
      // Add messages for this date (newest first within the date)
      const dateMessages = [...grouped[date]].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Add itemType to each message
      dateMessages.forEach(msg => {
        listData.push({ ...msg, itemType: 'message' as const });
      });

      // Add date separator AFTER the messages (will appear above in inverted list)
      listData.push({
        itemType: 'dateSeparator' as const,
        date,
        id: `date-${date}`
      });
    });

    return listData;
  }, [messages]);

  // Format date for display
  const formatDateForDisplay = useCallback((dateString: string) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayIST = formatISTDate(today, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: undefined,
      minute: undefined,
      hour12: undefined
    });
    const yesterdayIST = formatISTDate(yesterday, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: undefined,
      minute: undefined,
      hour12: undefined
    });

    if (dateString === todayIST) {
      return "Today";
    } else if (dateString === yesterdayIST) {
      return "Yesterday";
    } else {
      return dateString;
    }
  }, []);

  // Helper function to add message
  const addMessage = useCallback((message: Message, updateCache: boolean = true) => {
    if (!messagesSet.has(message.id)) {
      setMessagesSet(prev => new Set(prev).add(message.id));
      setMessages(prev => {
        const newMessages = [...prev, message];
        if (updateCache && roomId) {
          MessageStorage.addMessage(roomId as string, message);
        }
        return newMessages;
      });
    }
  }, [messagesSet, roomId]);

  // Helper function to remove message
  const removeMessage = useCallback((messageId: string | number, updateCache: boolean = true) => {
    setMessagesSet(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
    setMessages(prev => {
      const newMessages = prev.filter(msg => msg.id !== messageId);
      if (updateCache && roomId) {
        MessageStorage.removeMessages(roomId as string, [messageId]);
      }
      return newMessages;
    });
  }, [roomId]);

  // Helper function to update message
  const updateMessage = useCallback((messageId: string | number, updatedMessage: Message, updateCache: boolean = true) => {
    setMessages(prev => {
      const newMessages = prev.map(msg => msg.id === messageId ? updatedMessage : msg);
      if (updateCache && roomId) {
        MessageStorage.updateMessage(roomId as string, messageId, updatedMessage);
      }
      return newMessages;
    });
  }, [roomId]);

  // Helper function to update specific message fields
  const updateMessageFields = useCallback((messageId: string | number, updates: Partial<Message>) => {
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.id === messageId) {
          const updatedMsg = { ...msg, ...updates };
          if (roomId) {
            MessageStorage.updateMessage(roomId as string, messageId, updates);
          }
          return updatedMsg;
        }
        return msg;
      });
    });
  }, [roomId]);

  // Scroll to bottom function for inverted list
  // In inverted list, scrollToOffset(0) scrolls to the "bottom" (newest messages)
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      setShowScrollToBottom(false);
      setIsNearBottom(true);
    }
  }, [messages.length]);

  // Handle scroll events for inverted list
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    // In inverted list, offset 0 is at the bottom (newest messages)
    // User is "near bottom" when offset is close to 0
    const isAtBottom = contentOffset.y < 100;

    setIsNearBottom(isAtBottom);
    setShowScrollToBottom(!isAtBottom && messages.length > 10);
  }, [messages.length]);

  // Scroll to specific message with blink effect
  const scrollToMessage = useCallback((messageId: string | number) => {
    const messageIndex = preparedListData.findIndex(item =>
      'id' in item && item.type !== 'date' && item.id === messageId
    );

    if (messageIndex !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: messageIndex,
        animated: true,
        viewPosition: 0.5
      });

      // Add blink effect
      const blinkAnimation = new Animated.Value(0);
      blinkAnimations.current.set(messageId, blinkAnimation);

      Animated.sequence([
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(() => {
        blinkAnimations.current.delete(messageId);
      });
    }
  }, [preparedListData]);

  // Load cached messages first
  const loadCachedMessages = useCallback(async (): Promise<boolean> => {
    if (!roomId) return false;

    try {
      const cachedData = await MessageStorage.getMessages(roomId as string);

      if (cachedData && cachedData.messages.length > 0) {
        console.log(`�� Displaying ${cachedData.messages.length} cached messages`);

        setMessages(cachedData.messages);
        setMessagesSet(new Set(cachedData.messages.map(msg => msg.id)));
        setIsFromCache(true);
        setIsLoading(false);
        isInitialLoad.current = false;

        return true;
      }
      return false;
    } catch (error) {
      console.log('❌ Error loading cached messages:', error);
      return false;
    }
  }, [roomId]);

  // Sync messages with server
  const syncMessagesWithServer = useCallback(async (forceRefresh: boolean = false) => {
    if (!roomId) return;

    try {
      setIsSyncing(true);
      console.log('🔄 Syncing messages with server...');

      const token = await AuthStorage.getToken();
      const userId = (await AuthStorage.getUser())?.seid;
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}`,userId: userId },
      });

      console.log("response", response.data);
      if(response.data.isrestricted) {
        await logout();
        Alert.alert("Access denied", "You are not authorized to access this chat room. Please contact Sevak Karyalay.");
        router.replace({
          pathname: "/(auth)/login",
          params: { from: "logout" }
        });
        return;
      } else {
        console.log("Allowed");
      }

      const freshMessages: Message[] = response.data.messages || [];

      const cachedData = await MessageStorage.getMessages(roomId as string);
      const cachedMessages = cachedData?.messages || [];

      const { newMessages, updatedMessages, deletedMessageIds, hasChanges } =
        MessageStorage.detectChanges(cachedMessages, freshMessages);
      console.log("newMessages", newMessages);
      console.log("updatedMessages", updatedMessages);
      console.log("deletedMessageIds", deletedMessageIds);
      console.log(`hasChanges in chatroom ${roomId}`, hasChanges);
      if (hasChanges || forceRefresh) {
        console.log('✨ Changes detected, updating UI and cache');

        if (deletedMessageIds.length > 0) {
          setMessagesSet(prev => {
            const newSet = new Set(prev);
            deletedMessageIds.forEach(id => newSet.delete(id));
            return newSet;
          });
          setMessages(prev => prev.filter(msg => !deletedMessageIds.includes(msg.id)));
        }

        if (updatedMessages.length > 0) {
          setMessages(prev => {
            return prev.map(msg => {
              const updatedMsg = updatedMessages.find(u => u.id === msg.id);
              return updatedMsg || msg;
            });
          });
        }

        if (newMessages.length > 0) {
          setMessagesSet(prev => {
            const newSet = new Set(prev);
            newMessages.forEach(msg => newSet.add(msg.id));
            return newSet;
          });
          setMessages(prev => {
            const allMessages = [...prev, ...newMessages];
            return allMessages.sort((a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        }

        await MessageStorage.saveMessages(roomId as string, freshMessages);
      } else {
        console.log('✅ No changes detected, cache is up to date');
      }

      setRoom(response.data);

      const initialMembers = response.data.members.map((member: ChatUser) => ({
        ...member,
        userId: String(member.userId),
        isOnline: false,
      }));
      setRoomMembers(initialMembers);

      const userData = await AuthStorage.getUser();
      if (userData) {
        const isUserGroupAdmin = response.data.members.some(
          (member: ChatUser) =>
            member.userId === userData?.userId && member.isAdmin
        );
        setIsGroupAdmin(isUserGroupAdmin);
      }

      setIsFromCache(false);
    } catch (error) {
      console.log('❌ Error syncing with server:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [roomId]);

  // Main load function
  const loadRoomDetails = useCallback(async (forceRefresh: boolean = false) => {
    try {
      const userData = await AuthStorage.getUser();
      if (userData) {
        console.log("userData", userData);
        setCurrentUser({
          userId: userData.userId,
          fullName: userData.fullName || null
        });
      }

      if (!forceRefresh) {
        const hasCachedData = await loadCachedMessages();

        if (hasCachedData) {
          syncMessagesWithServer(false);

          if (userData && roomId) {
            socketService.joinRoom(
              roomId as string,
              userData.userId,
              userData.fullName || "Anonymous"
            );
            clearRoomNotifications(roomId as string);
          }

          return;
        }
      }

      setIsLoading(true);

      const token = await AuthStorage.getToken();
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if(response.data.isrestricted) {
        await logout();
        ToastAndroid.show("Access denied", ToastAndroid.SHORT);
        router.replace({
          pathname: "/(auth)/login",
          params: { from: "logout" }
        });
        return;
      }

      setRoom(response.data);
      const initialMessages = response.data.messages || [];
      setMessages(initialMessages);
      setMessagesSet(new Set(initialMessages.map((msg: Message) => msg.id)));

      await MessageStorage.saveMessages(roomId as string, initialMessages);

      const isUserGroupAdmin = response.data.members.some(
        (member: ChatUser) =>
          member.userId === userData?.userId && member.isAdmin
      );
      setIsGroupAdmin(isUserGroupAdmin);

      const initialMembers = response.data.members.map((member: ChatUser) => ({
        ...member,
        userId: String(member.userId),
        isOnline: false,
      }));
      setRoomMembers(initialMembers);

      if (userData) {
        socketService.joinRoom(
          roomId as string,
          userData.userId,
          userData.fullName || "Anonymous"
        );
        clearRoomNotifications(roomId as string);
        loadScheduledMessages();
      }
    } catch (error) {
      console.log("Error loading room details:", error);

      const hasCachedData = await loadCachedMessages();
      if (!hasCachedData) {
        alert("Failed to load chat room details");
      }
    } finally {
      setIsLoading(false);
      isInitialLoad.current = false;
    }
  }, [roomId, loadCachedMessages, syncMessagesWithServer]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);

      if (appState.match(/inactive|background/) && nextAppState === "active") {
        console.log("📱 App came to foreground - syncing messages");
        syncMessagesWithServer(false);

        if (!socketService.socket?.connected) {
          const socket = socketService.connect();
          if (socket && currentUser && roomId) {
            socketService.identify(currentUser.userId);
            socketService.joinRoom(
              roomId as string,
              currentUser.userId,
              currentUser.fullName || "Anonymous"
            );
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appState, currentUser, roomId, syncMessagesWithServer]);

  // Connect to socket when component mounts
  useEffect(() => {
    socketService.connect();
  }, []);

  // Handle Android back button
  useEffect(() => {
    const onBackPress = () => {
      if (selectedMessages.length > 0) {
        clearSelection();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [selectedMessages]);

  // Handle keyboard events - No need to scroll manually with inverted list
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        // Inverted list handles this automatically
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // Inverted list handles this automatically
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Join room and set up socket event listeners
  useEffect(() => {
    if (roomId && currentUser) {
      socketService.joinRoom(
        roomId as string,
        currentUser.userId,
        currentUser.fullName || "Anonymous"
      );

      socketService.onOnlineUsers(
        ({ roomId: updatedRoomId, onlineUsers: users }) => {
          if (updatedRoomId === roomId) {
            setOnlineUsers(users.map(String));
          }
        }
      );

      socketService.onRoomMembers(({ roomId: updatedRoomId, members }) => {
        if (updatedRoomId === roomId) {
          setRoomMembers(
            members.map((m: any) => ({
              ...m,
              userId: String(m.userId),
            }))
          );
        }
      });

      socketService.onNewMessage((data) => {
        if (data.roomId === roomId) {
          console.log("New message received:", data);

          if (data.sender.userId !== currentUser.userId) {
            const newMessage: Message = {
              id: data.id,
              roomId: parseInt(data.roomId),
              senderId: data.sender.userId,
              senderName: data.sender.userName,
              messageText: data.messageText,
              messageType: data.messageType,
              createdAt: data.createdAt,
              mediaFilesId: data?.mediaFilesId,
              pollId: data?.pollId,
              tableId: data?.tableId
            };

            addMessage(newMessage, true);
            // No need to scroll - inverted list shows newest at bottom automatically
          }
        }
      });

      socketService.onMessagesDeleted((data) => {
        if (data.roomId === roomId) {
          console.log("Messages deleted:", data);
          data.messageIds.forEach((messageId: string | number) => {
            removeMessage(messageId, true);
          });
        }
      });

      socketService.onMessageEdited((data) => {
        if (data.roomId === roomId) {
          console.log("Message edited:", data);
          updateMessageFields(data.messageId, {
            messageText: data.messageText,
            isEdited: data.isEdited,
            editedAt: data.editedAt,
            editedBy: data.editedBy,
            editorName: data.editorName
          });
        }
      });

      return () => {
        socketService.leaveRoom(roomId as string, currentUser.userId);
      };
    }
  }, [roomId, currentUser, addMessage, removeMessage, updateMessageFields]);

  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        loadRoomDetails();
      }
      return () => {
        setSelectedMessages([]);
        setIsReplying(false);
        setReplyToMessage(null);
        setActivePollId(null);
        setShowPollModal(false);
      };
    }, [roomId])
  );

  useEffect(() => {
    return () => {
      navigation.setOptions({
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 60,
          paddingBottom: 5,
        }
      });
    };
  }, [navigation]);

  const loadScheduledMessages = async () => {
    try {
      if (!roomId) return;

      const response = await getScheduledMessages(roomId as string);
      if (response.success) {
        setScheduledMessages(response.scheduledMessages);
      }
    } catch (error) {
      console.log("Error loading scheduled messages:", error);
    }
  };

  // Send message function
  const sendMessage = async (
    text: string,
    messageType: string,
    mediaFilesId?: number,
    pollId?: number,
    tableId?: number,
    replyMessageId?: number,
    scheduledAt?: string
  ) => {
    if (!isGroupAdmin) {
      alert("Only group admins can send messages in this room.");
      return;
    }

    if ((!text.trim() && (!mediaFilesId || !pollId || !tableId)) || !roomId || !currentUser || sending) return;

    const trimmedMessage = text.trim();

    try {
      setSending(true);
      setIsReplying(false);
      setMessageText("");

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        roomId: parseInt(roomId as string),
        senderId: currentUser.userId,
        senderName: currentUser.fullName || "You",
        messageText: trimmedMessage,
        messageType: messageType,
        createdAt: new Date().toISOString(),
        mediaFilesId: mediaFilesId,
        pollId: pollId,
        tableId: tableId,
        replyMessageId: replyMessageId,
        ...(replyMessageId && replyToMessage && {
          replySenderName: replyToMessage.senderName,
          replyMessageText: replyToMessage.messageText,
          replyMessageType: replyToMessage.messageType
        })
      };

      addMessage(optimisticMessage, false);
      // No need to scroll - inverted list shows newest at bottom automatically

      const token = await AuthStorage.getToken();
      const response = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        {
          messageText: trimmedMessage,
          mediaFilesId: mediaFilesId,
          pollId: pollId,
          messageType: messageType,
          tableId: tableId,
          replyMessageId: replyMessageId,
          scheduledAt: scheduledAt
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.scheduledMessage) {
        loadScheduledMessages();
        setMessages(prev => prev.filter(msg => !(typeof msg.id === 'string' && msg.id.includes('temp'))));
        return;
      }

      const newMessages = Array.isArray(response.data)
        ? response.data
        : [response.data];

      const messagesWithSenderName = newMessages.map(msg => ({
        ...msg,
        senderName: currentUser.fullName || "You",
      }));

      const messagesWithReplyInfo = messagesWithSenderName.map(msg => {
        if (msg.replyMessageId && replyToMessage) {
          return {
            ...msg,
            replySenderName: replyToMessage.senderName,
            replyMessageText: replyToMessage.messageText,
            replyMessageType: replyToMessage.messageType
          };
        }
        return msg;
      });

      setMessages(prev => {
        const filteredMessages = prev.filter(
          msg => !(typeof msg.id === 'string' && msg.id.includes('temp'))
        );
        const newMessagesList = [...filteredMessages, ...messagesWithReplyInfo];

        MessageStorage.saveMessages(roomId as string, newMessagesList);

        return newMessagesList;
      });

      setMessagesSet(prev => {
        const newSet = new Set(prev);
        Array.from(newSet).forEach(id => {
          if (typeof id === 'string' && id.includes('temp')) {
            newSet.delete(id);
          }
        });
        messagesWithSenderName.forEach(msg => newSet.add(msg.id));
        return newSet;
      });

      messagesWithSenderName.forEach(newMessage => {
        socketService.sendMessage(roomId as string, newMessage, {
          userId: currentUser.userId,
          userName: currentUser.fullName || "Anonymous",
        });
      });

      if (isReplying) {
        setIsReplying(false);
        setReplyToMessage(null);
      }
    } catch (error) {
      console.log("Error sending message:", error);
      alert("Failed to send message");

      setMessageText(trimmedMessage);

      setMessages(prev => prev.filter(msg => typeof msg.id === "number" || (typeof msg.id === 'string' && !msg.id.includes('temp'))));
      setMessagesSet(prev => {
        const newSet = new Set(prev);
        Array.from(newSet).forEach(id => {
          if (typeof id === 'string' && id.includes('temp')) {
            newSet.delete(id);
          }
        });
        return newSet;
      });
    } finally {
      setSending(false);
    }
  };

  // Helper functions for media, selection, reply, gestures, etc.
  const openMediaViewer = (mediaId: number) => {
    setSelectedMediaId(mediaId);
    setShowMediaViewer(true);
  };

  const handleMediaGridPress = (mediaFiles: any[], selectedIndex: number) => {
    setSelectedMediaFiles(mediaFiles);
    setSelectedMediaIndex(selectedIndex);
    setShowMediaViewer(true);
  };

  const isMessageSelected = (messageId: string | number) => {
    return selectedMessages.some(msg => msg.id === messageId);
  };

  const handleMessageLongPress = (message: Message) => {
    if (!isGroupAdmin) return;

    if (selectedMessages.length === 0) {
      setSelectedMessages([message]);
    } else {
      if (!isMessageSelected(message.id)) {
        setSelectedMessages(prev => [...prev, message]);
      }
    }
  };

  const handleMessagePress = (message: Message) => {
    if (!isGroupAdmin) return;

    if (selectedMessages.length > 0) {
      if (isMessageSelected(message.id)) {
        setSelectedMessages(prev => prev.filter(msg => msg.id !== message.id));
      } else {
        setSelectedMessages(prev => [...prev, message]);
      }
    }
  };

  const clearSelection = () => {
    setSelectedMessages([]);
  };

  const handleStartReply = (message: Message) => {
    setReplyToMessage(message);
    setIsReplying(true);
    setSelectedMessages([]);
  };

  const handleReplyPreviewClick = (messageId: string | number) => {
    scrollToMessage(messageId);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
    setIsReplying(false);
  };

  const getMessageAnimation = (messageId: string | number) => {
    if (!messageAnimations.current.has(messageId)) {
      messageAnimations.current.set(messageId, new Animated.Value(0));
    }
    return messageAnimations.current.get(messageId)!;
  };

  const handleGestureBegin = (messageId: string | number) => {
    const animation = getMessageAnimation(messageId);
    animation.setValue(0);
    hapticTriggered.current.set(messageId, false);
  };

  const handleGestureUpdate = (event: any, messageId: string | number) => {
    const { translationX } = event.nativeEvent;
    const animation = getMessageAnimation(messageId);

    const maxTranslation = 80;
    const limitedTranslation = Math.max(-maxTranslation, Math.min(maxTranslation, translationX));

    animation.setValue(limitedTranslation);

    const threshold = 60;
    if (Math.abs(limitedTranslation) > threshold && !hapticTriggered.current.get(messageId)) {
      hapticTriggered.current.set(messageId, true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleGestureEnd = (event: any, message: Message) => {
    const { translationX, velocityX } = event.nativeEvent;
    const animation = getMessageAnimation(message.id);
    const threshold = 70;
    const velocityThreshold = 800;

    if (Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold) {
      handleStartReply(message);

      Animated.spring(animation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    } else {
      Animated.spring(animation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    }
  };

  const handleMessageEdited = (editedMessage: Message) => {
    updateMessage(editedMessage.id, editedMessage, true);
  };

  const markMessageAsRead = useCallback(async (messageId: string | number) => {
    if (typeof messageId !== "number") return;
    if (readSetRef.current.has(messageId)) return;
    readSetRef.current.add(messageId);
    try {
      const token = await AuthStorage.getToken();
      await axios.post(
        `${API_URL}/api/chat/messages/${messageId}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.log('Error marking message as read:', error);
    }
  }, []);

  const fetchReadStatus = async (messageId: string | number) => {
    try {
      setIsLoadingReadStatus(true);
      const token = await AuthStorage.getToken();
      const response = await axios.get(
        `${API_URL}/api/chat/messages/${messageId}/read-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setReadStatusData(response.data.data);
      }
    } catch (error) {
      console.log('Error fetching read status:', error);
      alert('Failed to load read status');
    } finally {
      setIsLoadingReadStatus(false);
    }
  };

  const handleInfoPress = (message: Message) => {
    setSelectedMessageForReadStatus(message);
    setShowReadStatus(true);
    fetchReadStatus(message.id);
  };

  const refreshReadStatus = () => {
    if (selectedMessageForReadStatus) {
      fetchReadStatus(selectedMessageForReadStatus.id);
    }
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (!currentUser) return;

    viewableItems.forEach((item: any) => {
      const message = item.item;
      if (message && message.type !== 'date' && message.senderId !== currentUser.userId && typeof message.id === 'number') {
        markMessageAsRead(message.id);
      }
    });
  }, [currentUser, markMessageAsRead]);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const handleForwardMessages = async (selectedRooms: ChatRoom[], messagesToForward: Message[]) => {
    const totalOperations = selectedRooms.length * messagesToForward.length;
    let completedOperations = 0;

    for (const room of selectedRooms) {
      if (!room.roomId) continue;

      for (const message of messagesToForward) {
        try {
          completedOperations++;
          console.log(`Forwarding message ${completedOperations}/${totalOperations} to room ${room.roomName}`);

          const token = await AuthStorage.getToken();
          const response = await axios.post(
            `${API_URL}/api/chat/rooms/${room.roomId}/messages`,
            {
              messageText: message.messageText || "",
              mediaFilesId: message.mediaFilesId,
              pollId: message.pollId,
              messageType: message.messageType,
              tableId: message.tableId
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const createdMessage = response.data;

          if (currentUser && createdMessage) {
            socketService.sendMessage(room.roomId.toString(), {
              id: createdMessage.id,
              roomId: room.roomId,
              senderId: currentUser.userId,
              senderName: currentUser.fullName || "You",
              messageText: message.messageText || "",
              messageType: message.messageType,
              createdAt: createdMessage.createdAt,
              mediaFilesId: message.mediaFilesId,
              pollId: message.pollId,
              tableId: message.tableId
            }, {
              userId: currentUser.userId,
              userName: currentUser.fullName || "Anonymous",
            });
          }

          if (completedOperations < totalOperations) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.log(`Error forwarding message to room ${room.roomName}:`, error);
          throw error;
        }
      }
    }

    clearSelection();
    setShowForwardModal(false);
  };

  const handleDeleteMessages = async (messageIds: (string | number)[]) => {
    try {
      const token = await AuthStorage.getToken();
      await axios.delete(`${API_URL}/api/chat/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { messageIds }
      });

      messageIds.forEach(id => removeMessage(id, true));
    } catch (error) {
      console.log('Error deleting messages:', error);
      throw error;
    }
  };

  // Render date separator
  const renderDateSeparator = (dateString: string) => (
    <View className="flex-row items-center my-4 px-4">
      <View className="flex-1 h-px bg-gray-300" />
      <Text className="mx-3 text-gray-500 text-sm font-medium">
        {formatDateForDisplay(dateString)}
      </Text>
      <View className="flex-1 h-px bg-gray-300" />
    </View>
  );

  // Render message function
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUser?.userId;
    const isSelected = isMessageSelected(item.id);
    const canPerformActions = isOwnMessage && isGroupAdmin;

    let messageStatus: "sending" | "sent" | "delivered" | "read" | "error" = "sent";

    if (typeof item.id === "number") {
      messageStatus = "delivered";
    } else if (typeof item.id === "string") {
      if (item.id.toString().includes("temp")) {
        messageStatus = "sending";
      }
    }

    const messageAnimation = getMessageAnimation(item.id);

    return (
      <View className="relative">
        {/* Reply icon backgrounds */}
        <Animated.View
          className="absolute top-0 bottom-0 right-4 flex items-center justify-center"
          style={{
            opacity: messageAnimation.interpolate({
              inputRange: [-80, -30, 0],
              outputRange: [1, 0.5, 0],
              extrapolate: 'clamp',
            }),
          }}
        >
          <View className="bg-blue-500 rounded-full p-2">
            <Ionicons name="arrow-undo" size={20} color="white" />
          </View>
        </Animated.View>

        <Animated.View
          className="absolute top-0 bottom-0 left-4 flex items-center justify-center"
          style={{
            opacity: messageAnimation.interpolate({
              inputRange: [0, 30, 80],
              outputRange: [0, 0.5, 1],
              extrapolate: 'clamp',
            }),
          }}
        >
          <View className="bg-blue-500 rounded-full p-2">
            <Ionicons name="arrow-undo" size={20} color="white" />
          </View>
        </Animated.View>

        <PanGestureHandler
          onBegan={() => handleGestureBegin(item.id)}
          onGestureEvent={(event) => handleGestureUpdate(event, item.id)}
          onEnded={(event) => handleGestureEnd(event, item)}
          onCancelled={(event) => handleGestureEnd(event, item)}
          onFailed={(event) => handleGestureEnd(event, item)}
          enabled={!isMessageSelected(item.id)}
          activeOffsetX={[-20, 20]}
          failOffsetY={[-30, 30]}
          shouldCancelWhenOutside={true}
          minPointers={1}
          maxPointers={1}
        >
          <Animated.View
            style={{
              transform: [{ translateX: messageAnimation }],
            }}
          >
            <Pressable
              onPress={() => handleMessagePress(item)}
              onLongPress={() => handleMessageLongPress(item)}
              delayLongPress={300}
              className="relative"
            >
              {isSelected && (
                <View
                  className="absolute top-0 bottom-0 left-0 right-0 bg-black"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.15)',
                    marginLeft: -16,
                    marginRight: -16,
                    zIndex: 1
                  }}
                />
              )}

              <Animated.View
                className={`px-3 py-2 mx-4 my-2 rounded-2xl relative ${isOwnMessage ? "bg-blue-100 ml-16" : "bg-gray-100 mr-16"
                  }`}
                style={{
                  zIndex: 2,
                  maxWidth: '85%',
                  alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                  backgroundColor: blinkAnimations.current.get(item.id) ?
                    blinkAnimations.current.get(item.id)!.interpolate({
                      inputRange: [0, 1],
                      outputRange: [isOwnMessage ? '#dbeafe' : '#f3f4f6', '#fbbf24']
                    }) :
                    (isOwnMessage ? '#dbeafe' : '#f3f4f6')
                }}
              >
                {/* Reply preview */}
                {item.replyMessageId && (
                  <TouchableOpacity
                    className={`mb-2 p-2 rounded-lg border-l-2 ${isOwnMessage
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-400'
                      }`}
                    onPress={() => handleReplyPreviewClick(item.replyMessageId!)}
                  >
                    <Text className={`text-xs ${isOwnMessage ? 'text-blue-600' : 'text-gray-600'}`}>
                      {item.replySenderName}
                    </Text>
                    <Text
                      className={`text-sm ${isOwnMessage ? 'text-blue-800' : 'text-gray-800'}`}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {(() => {
                        if (item.replyMessageType === 'media') return '📁 Media Files';
                        if (item.replyMessageType === 'poll') return '📊 Poll';
                        if (item.replyMessageType === 'table') return '📋 Table';
                        return item.replyMessageText || 'Message';
                      })()}
                    </Text>
                  </TouchableOpacity>
                )}

                {!isOwnMessage && (
                  <Text className="text-xs font-semibold text-blue-600 mb-1">
                    {item.senderName || "Unknown"}
                  </Text>
                )}

                {/* Message content rendering */}
                {item.messageType === 'announcement' ? (
                  <View
                    className={`p-3 rounded-lg ${isOwnMessage ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-orange-50 border-l-4 border-orange-500'}`}
                  >
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="megaphone" size={20} color={isOwnMessage ? '#2563eb' : '#f97316'} />
                      <Text className={`ml-2 font-bold text-sm ${isOwnMessage ? 'text-blue-600' : 'text-orange-600'}`}>
                        ANNOUNCEMENT
                      </Text>
                    </View>
                    {(() => {
                      const SEPARATOR = "|||ANNOUNCEMENT_SEPARATOR|||";
                      const parts = item.messageText.split(SEPARATOR);
                      const title = parts[0] || 'Untitled';
                      const body = parts[1] || '';
                      const contentWidth = screenWidth - 100;

                      const tagsStyles = {
                        body: { color: '#1f2937', fontSize: 15, lineHeight: 22 },
                        p: { marginVertical: 4 },
                        // ... other tag styles
                      };

                      return (
                        <>
                          <Text className={`text-lg font-bold mb-2 ${isOwnMessage ? 'text-blue-900' : 'text-gray-900'}`}>
                            {title}
                          </Text>
                          {body && body.trim() !== '' && body !== '<p></p>' && body !== '<p><br></p>' && (
                            <View className="mb-2 p-2 rounded-lg" style={{ backgroundColor: isOwnMessage ? '#eff6ff' : '#fff7ed' }}>
                              <RenderHtml
                                contentWidth={contentWidth}
                                source={{ html: body }}
                                tagsStyles={tagsStyles}
                                enableExperimentalMarginCollapsing={true}
                              />
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>
                ) : item.messageText ? (
                  <View>
                    <Text className={`text-base leading-5 ${isOwnMessage ? "text-gray-900" : "text-gray-800"}`}>
                      {item.messageText}
                    </Text>
                  </View>
                ) : null}

                {/* Audio messages */}
                {item.mediaFilesId && item.messageType === 'audio' ? (
                  <View className="mt-1">
                    <AudioMessagePlayer
                      audioUrl={`${API_URL}/media/chat/${item.mediaFilesId}`}
                      duration={item.messageText?.includes('(') ? item.messageText.match(/\(([^)]+)\)/)?.[1] : undefined}
                      isOwn={isOwnMessage}
                      waves={[]}
                    />
                  </View>
                ) : item.mediaFilesId ? (
                  <View className="mt-2">
                    <MediaGrid
                      mediaFilesId={item.mediaFilesId}
                      messageId={item.id}
                      onMediaPress={handleMediaGridPress}
                      isOwnMessage={isOwnMessage}
                      isLoading={false}
                    />
                  </View>
                ) : null}

                {/* Table */}
                {item.tableId ? (
                  <TouchableOpacity
                    onPress={() => {
                      if (typeof item.tableId === 'number') {
                        setTableId(item.tableId);
                        setShowTableModel(true);
                      }
                    }}
                    className={`p-2 rounded-lg mt-1 ${isOwnMessage ? 'bg-blue-200' : 'bg-gray-200'}`}
                  >
                    <Text className={`font-semibold ${isOwnMessage ? 'text-blue-800' : 'text-gray-700'}`}>📊 Table</Text>
                    <Text className={`text-xs ${isOwnMessage ? 'text-blue-600' : 'text-gray-600'}`}>Tap to view table</Text>
                  </TouchableOpacity>
                ) : null}

                {showTableModle && tableId !== null && currentUser?.userId && (
                  <RenderTable tableId={tableId} visible={showTableModle} setShowTable={setShowTableModel} />
                )}

                {/* Poll */}
                {item.pollId ? (
                  <TouchableOpacity
                    onPress={() => {
                      if (typeof item.pollId === 'number' && !showPollModal) {
                        setActivePollId(item.pollId);
                        setShowPollModal(true);
                      }
                    }}
                    disabled={showPollModal && activePollId !== item.pollId}
                    className={`p-3 rounded-lg mt-1 ${showPollModal && activePollId !== item.pollId
                      ? 'bg-gray-200 opacity-50'
                      : isOwnMessage ? 'bg-blue-200' : 'bg-gray-200'
                      }`}
                  >
                    <Text className={`font-semibold ${showPollModal && activePollId !== item.pollId
                      ? 'text-gray-500'
                      : isOwnMessage ? 'text-blue-800' : 'text-gray-700'
                      }`}>
                      📊 Poll
                    </Text>
                    <Text className={`text-xs ${showPollModal && activePollId !== item.pollId
                      ? 'text-gray-400'
                      : isOwnMessage ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                      {showPollModal && activePollId !== item.pollId ? 'Another poll is active' : 'Tap to vote'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Time and status */}
                <View className="flex-row justify-end items-center mt-1">
                  <Text className={`text-xs ${isOwnMessage ? "text-gray-600" : "text-gray-500"}`}>
                    {formatISTTime(item.editedAt || item.createdAt || "")}
                  </Text>
                  {isOwnMessage && (
                    <View className="ml-1">
                      <MessageStatus status={messageStatus} />
                    </View>
                  )}
                  {item.isEdited && (
                    <Text className={`text-xs italic ml-1 ${isOwnMessage ? "text-gray-600" : "text-gray-500"}`}>
                      edited
                    </Text>
                  )}
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </PanGestureHandler>
      </View>
    );
  };

  // Render item for FlatList (handles both messages and date separators)
  const renderItem = useCallback(({ item }: { item: ChatListItem }) => {
    if (item.itemType === 'dateSeparator') {
      return <DateSeparator dateString={item.date} formatDateForDisplay={formatDateForDisplay} />;
    }

    const message = item as Message & { itemType: 'message' };
    const isOwnMessage = message.senderId === currentUser?.userId;
    const isSelected = isMessageSelected(message.id);
    const messageAnimation = getMessageAnimation(message.id);
    const blinkAnimation = blinkAnimations.current.get(message.id);

    // Only render text messages for now
    if (message.messageType !== 'text' && message.messageType !== 'timeline') {
      return null;
    }

    return (
      <View>
        {/* Reply icon backgrounds */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 16,
            justifyContent: 'center',
            opacity: messageAnimation.interpolate({
              inputRange: [-80, -30, 0],
              outputRange: [1, 0.5, 0],
              extrapolate: 'clamp',
            }),
          }}
        >
          <View style={{ backgroundColor: '#0088CC', borderRadius: 20, padding: 8 }}>
            <Ionicons name="arrow-undo" size={20} color="white" />
          </View>
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 16,
            justifyContent: 'center',
            opacity: messageAnimation.interpolate({
              inputRange: [0, 30, 80],
              outputRange: [0, 0.5, 1],
              extrapolate: 'clamp',
            }),
          }}
        >
          <View style={{ backgroundColor: '#0088CC', borderRadius: 20, padding: 8 }}>
            <Ionicons name="arrow-undo" size={20} color="white" />
          </View>
        </Animated.View>

        <PanGestureHandler
          onBegan={() => handleGestureBegin(message.id)}
          onGestureEvent={(event) => handleGestureUpdate(event, message.id)}
          onEnded={(event) => handleGestureEnd(event, message)}
          onCancelled={(event) => handleGestureEnd(event, message)}
          onFailed={(event) => handleGestureEnd(event, message)}
          enabled={!isSelected}
          activeOffsetX={[-20, 20]}
          failOffsetY={[-30, 30]}
        >
          <Animated.View style={{ transform: [{ translateX: messageAnimation }] }}>
            <MessageBubble
              item={message}
              isOwnMessage={isOwnMessage}
              isSelected={isSelected}
              currentUser={currentUser}
              onPress={() => handleMessagePress(message)}
              onLongPress={() => handleMessageLongPress(message)}
              onReplyPreviewClick={handleReplyPreviewClick}
              formatTime={formatISTTime}
              messageAnimation={messageAnimation}
              blinkAnimation={blinkAnimation}
            />
          </Animated.View>
        </PanGestureHandler>
      </View>
    );
  }, [currentUser, selectedMessages, formatDateForDisplay, handleMessagePress, handleMessageLongPress, handleReplyPreviewClick]);
  // Key extractor for FlatList
  const keyExtractor = useCallback((item: ChatListItem) => {
    if (item.itemType === 'dateSeparator') {
      return item.id;
    }
    return `msg-${(item as Message).id}`;
  }, []);

  // Get item layout for better scroll performance (optional)
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 80, // Approximate height of each item
    offset: 80 * index,
    index,
  }), []);

  if (isLoading && isInitialLoad.current) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-gray-500 mt-2">Loading messages...</Text>
      </View>
    );
  }

  if (!room && !isFromCache && messages.length === 0) {
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
    <GestureHandlerRootView className="flex-1">
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {/* Header */}
          {selectedMessages.length > 0 && isGroupAdmin ? (
            <ChatMessageOptions
              selectedMessages={selectedMessages}
              setSelectedMessages={setSelectedMessages}
              isAdmin={isGroupAdmin}
              onClose={clearSelection}
              onForwardPress={() => setShowForwardModal(true)}
              onDeletePress={handleDeleteMessages}
              onInfoPress={handleInfoPress}
              roomId={Array.isArray(roomId) ? roomId[0] : roomId}
              roomMembers={roomMembers}
              currentUser={currentUser}
              onMessageEdited={handleMessageEdited}
            />
          ) : (
            <>
              <TelegramHeader
                roomName={room?.roomName || "Chat"}
                memberCount={roomMembers.length}
                onlineCount={onlineUsers.length}
                onBackPress={() => router.back()}
                onAvatarPress={() => setShowMembersModal(true)}
                onMenuPress={isGroupAdmin ? () => router.push({
                  pathname: "/chat/room-info",
                  params: { roomId },
                }) : undefined}
                isSyncing={isSyncing}
              />
              {/* <OnlineUsersIndicator
              onlineCount={onlineUsers.length}
              totalCount={roomMembers.length}
              onPress={() => setShowMembersModal(true)}
              /> */}
            </>
          )}

          {/* Messages list - INVERTED */}
          <FlatList
            ref={flatListRef}
            data={preparedListData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            inverted={true}
            contentContainerStyle={styles.listContent}
            style={styles.chatContainer}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={15}
            windowSize={10}
            initialNumToRender={20}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                if (flatListRef.current && preparedListData.length > 0) {
                  flatListRef.current.scrollToIndex({
                    index: Math.min(info.index, preparedListData.length - 1),
                    animated: true,
                  });
                }
              });
            }}
            ListEmptyComponent={
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 400 }}>
                <Ionicons name="chatbubble-outline" size={60} color="#d1d5db" />
                <Text style={{ color: '#6b7280', marginTop: 16, textAlign: 'center' }}>
                  No messages yet.
                </Text>
              </View>
            }            
          />

          {/* Scroll to bottom button - For inverted list, this scrolls to offset 0 */}
          {showScrollToBottom && (
            <TouchableOpacity
              onPress={scrollToBottom}
              className="absolute bottom-20 right-4 bg-blue-500 rounded-full p-3 shadow-lg"
              style={{ zIndex: 1000 }}
            >
              <Ionicons name="arrow-down" size={20} color="white" />
            </TouchableOpacity>
          )}

          {/* Message input */}
          {isGroupAdmin && (
            <View style={{ backgroundColor: 'black' }}>
              {/* above view is below to messageinput component */}
              {/* Reply preview */}
              {isReplying && replyToMessage && (
                <View style={{
                  backgroundColor: '#F2F2F7',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: '#E5E5E5',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="arrow-undo" size={14} color="#007AFF" />
                        <Text style={{ fontSize: 13, color: '#007AFF', fontWeight: '600', marginLeft: 6 }}>
                          Replying to {replyToMessage.senderName}
                        </Text>
                      </View>
                      <Text
                        style={{ fontSize: 14, color: '#666' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {replyToMessage.messageText}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={handleCancelReply} style={{ padding: 8 }}>
                      <Ionicons name="close-circle" size={22} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              <MessageInput
                messageText={messageText}
                onChangeText={setMessageText}
                onSend={(text: string, messageType: string, scheduledAt?: string) => {
                  if (messageType === "audio") {
                    // Handle audio recording
                  } else {
                    sendMessage(
                      text, 
                      messageType, 
                      undefined, 
                      undefined, 
                      undefined, 
                      replyToMessage?.id as number, 
                      scheduledAt
                    );
                  }
                }}
                placeholder="Message"
                sending={sending}
                disabled={false}
                roomMembers={roomMembers}
                currentUser={currentUser}
                roomId={roomId as string}
                showAttachments={true}
                onAudioRecord={() => {}}
                onScheduleMessage={() => setShowScheduledMessages(true)}
                hasScheduledMessages={scheduledMessages.length > 0}
                onFocus={() => {}}
              />
            </View>
          )}

{/* Non-admin message */}
{!isGroupAdmin && (
  <View style={{
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
  }}>
    <Text style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14 }}>
      Only group admins can send messages in this room
    </Text>
  </View>
)}

          {/* Modals */}
          <MembersModal
            visible={showMembersModal}
            onClose={() => setShowMembersModal(false)}
            members={roomMembers.map((member) => ({
              userId: member.userId,
              fullName: member.fullName || "Unknown User",
              isAdmin: Boolean(member.isAdmin),
              isOnline: Boolean(member.isOnline),
            }))}
            currentUserId={currentUser?.userId || ""}
          />

          {showMediaViewer && (
            <MediaViewerModal
              visible={showMediaViewer}
              onClose={() => {
                setShowMediaViewer(false);
                setSelectedMediaId(null);
                setSelectedMediaFiles([]);
                setSelectedMediaIndex(0);
              }}
              mediaId={selectedMediaId || undefined}
              mediaFiles={selectedMediaFiles}
              initialIndex={selectedMediaIndex}
            />
          )}

          {isGroupAdmin && (
            <ForwardMessagesModal
              visible={showForwardModal}
              onClose={() => setShowForwardModal(false)}
              selectedMessages={selectedMessages}
              currentRoomId={roomId as string}
              onForward={handleForwardMessages}
            />
          )}

          <GlobalPollModal
            pollId={activePollId}
            visible={showPollModal}
            onClose={() => {
              setShowPollModal(false);
              setActivePollId(null);
            }}
            currentUserId={currentUser?.userId || ""}
            totalMembers={roomMembers.length}
          />

          {/* Read Status Modal */}
          <Modal
            visible={showReadStatus}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setShowReadStatus(false)}
          >
            <SafeAreaView className="flex-1 bg-white">
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
                <TouchableOpacity onPress={() => setShowReadStatus(false)} className="p-2">
                  <Ionicons name="arrow-back" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-lg font-semibold text-gray-900">Message Info</Text>
                <TouchableOpacity onPress={refreshReadStatus} disabled={isLoadingReadStatus} className="p-2">
                  <Ionicons name="refresh" size={24} color={isLoadingReadStatus ? "#9ca3af" : "#374151"} />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 px-4 py-4">
                {selectedMessageForReadStatus && (
                  <View className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <Text className="text-sm text-gray-600 mb-2">
                      {selectedMessageForReadStatus.senderName} • {formatISTDate(selectedMessageForReadStatus.createdAt)}
                    </Text>
                    <Text className="text-base text-gray-900" numberOfLines={3}>
                      {selectedMessageForReadStatus.messageText}
                    </Text>
                  </View>
                )}

                {isLoadingReadStatus ? (
                  <View className="items-center py-8">
                    <ActivityIndicator size="large" color="#0284c7" />
                    <Text className="text-gray-500 mt-2">Loading read status...</Text>
                  </View>
                ) : readStatusData ? (
                  <View>
                    {readStatusData.readBy.length > 0 && (
                      <View className="mb-6">
                        <Text className="text-lg font-semibold text-gray-900 mb-3">
                          Read by ({readStatusData.readBy.length})
                        </Text>
                        {readStatusData.readBy.map((user, index) => (
                          <View key={index} className="flex-row items-center justify-between py-2 border-b border-gray-100">
                            <Text className="text-gray-900">{user.fullName}</Text>
                            <Text className="text-sm text-gray-500">{formatISTDate(user.readAt)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {readStatusData.unreadBy.length > 0 && (
                      <View>
                        <Text className="text-lg font-semibold text-gray-900 mb-3">
                          Unread by ({readStatusData.unreadBy.length})
                        </Text>
                        {readStatusData.unreadBy.map((user, index) => (
                          <View key={index} className="flex-row items-center py-2 border-b border-gray-100">
                            <Text className="text-gray-500">{user.fullName}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {readStatusData.readBy.length === 0 && readStatusData.unreadBy.length === 0 && (
                      <View className="items-center py-8">
                        <Ionicons name="information-circle-outline" size={48} color="#d1d5db" />
                        <Text className="text-gray-500 mt-2">No read status available</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View className="items-center py-8">
                    <Text className="text-gray-500">Failed to load read status</Text>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>

          <AudioRecorder
            isVisible={showAudioRecorder}
            onRecordingComplete={() => { }}
            onCancel={() => {
              setShowAudioRecorder(false);
              setIsRecordingAudio(false);
            }}
          />

          {/* Scheduled Messages Modal */}
          <Modal
            visible={showScheduledMessages}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setShowScheduledMessages(false)}
          >
            <SafeAreaView className="flex-1 bg-white">
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
                <TouchableOpacity onPress={() => setShowScheduledMessages(false)} className="p-2">
                  <Ionicons name="arrow-back" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-lg font-semibold text-gray-900">Scheduled Messages</Text>
                <TouchableOpacity onPress={loadScheduledMessages} className="p-2">
                  <Ionicons name="refresh" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 px-4 py-4">
                {scheduledMessages.length === 0 ? (
                  <View className="flex-1 justify-center items-center py-8">
                    <Ionicons name="time-outline" size={60} color="#d1d5db" />
                    <Text className="text-gray-500 mt-4 text-center">No scheduled messages</Text>
                  </View>
                ) : (
                  scheduledMessages.map((message, index) => (
                    <View key={index} className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm text-gray-600">{message.senderName}</Text>
                        <Text className="text-sm text-gray-500">{formatISTDate(message.createdAt)}</Text>
                      </View>
                      <Text className="text-base text-gray-900 mb-2">{message.messageText}</Text>
                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={16} color="#6b7280" />
                        <Text className="text-sm text-gray-600 ml-1">
                          Scheduled for {formatISTDate(message.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
