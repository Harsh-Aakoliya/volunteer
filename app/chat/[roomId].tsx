// app/chat/[roomId].tsx
import * as React from 'react';
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
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
  LongPressGestureHandler,
  TapGestureHandler,
  GestureHandlerRootView,
  State,
} from 'react-native-gesture-handler';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import { MessageStorage } from "@/utils/messageStorage";
import { Message, ChatRoom, ChatUser } from "@/types/type";
import { formatISTTime, formatISTDate } from "@/utils/dateUtils";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { useFocusEffect } from "@react-navigation/native";
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
import { clearRoomNotifications } from "@/utils/chatNotificationHandler";
import { getScheduledMessages } from "@/api/chat";
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { logout } from '@/api/auth';
import { useSocket, useChatRoomSubscription } from '@/contexts/SocketContext';
import { 
  ChatMessage, 
  MessageEditedEvent, 
  MessagesDeletedEvent, 
  OnlineUsersUpdate,
  MemberInfo 
} from '@/utils/socketManager';

// ==================== TYPES ====================

interface RoomDetails extends ChatRoom {
  members: ChatUser[];
  messages: Message[];
}

type ChatListItem =
  | (Message & { itemType: 'message' })
  | { itemType: 'dateSeparator'; date: string; id: string };

// ==================== MEMOIZED COMPONENTS ====================

const MessageItem = React.memo(({
  message,
  isOwnMessage,
  isSelected,
  isGroupAdmin,
  currentUser,
  selectedMessagesCount,
  messageAnimation,
  blinkAnimation,
  showSenderName,      // UPDATED PROP NAME
  hasTail,             // UPDATED PROP NAME
  onSelect,
  onDeselect,
  onStartSelection,
  onGestureBegin,
  onGestureUpdate,
  onGestureEnd,
  onReplyPreviewClick,
  formatTime,
}: {
  message: Message;
  isOwnMessage: boolean;
  isSelected: boolean;
  isGroupAdmin: boolean;
  currentUser: { userId: string; fullName: string | null } | null;
  selectedMessagesCount: number;
  messageAnimation: Animated.Value;
  blinkAnimation?: Animated.Value;
  showSenderName: boolean;      // UPDATED PROP TYPE
  hasTail: boolean;             // UPDATED PROP TYPE
  onSelect: (message: Message) => void;
  onDeselect: (message: Message) => void;
  onStartSelection: (message: Message) => void;
  onGestureBegin: (messageId: string | number) => void;
  onGestureUpdate: (event: any, messageId: string | number) => void;
  onGestureEnd: (event: any, message: Message) => void;
  onReplyPreviewClick: (id: string | number) => void;
  formatTime: (date: string) => string;
}) => {
  const longPressRef = useRef(null);
  const panRef = useRef(null);
  const tapRef = useRef(null);

  const canSelect = isGroupAdmin || isOwnMessage;

  const handleLongPressStateChange = useCallback((event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      if (!canSelect) return;
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStartSelection(message);
    }
  }, [canSelect, message, onStartSelection]);

  const handleTapStateChange = useCallback((event: any) => {
    if (event.nativeEvent.state === State.END) {
      // Handle tap for selection toggle when in selection mode
      if (selectedMessagesCount > 0 && canSelect) {
        if (isSelected) {
          onDeselect(message);
        } else {
          onSelect(message);
        }
        return;
      }
      // Handle tap for reply preview when not in selection mode
      if (selectedMessagesCount === 0 && message.replyMessageId) {
        onReplyPreviewClick(message.replyMessageId);
      }
    }
  }, [selectedMessagesCount, canSelect, isSelected, message, onSelect, onDeselect, onReplyPreviewClick]);

  // Message status logic
  let messageStatus: "sending" | "sent" | "delivered" | "read" | "error" = "sent";
  if (typeof message.id === "number") {
    messageStatus = "delivered";
  } else if (typeof message.id === "string" && message.id.includes("temp")) {
    messageStatus = "sending";
  }

  // --- Dynamic border radius logic for WhatsApp-like tail ---
  const bubbleBorderRadius = useMemo(() => {
    const defaultRadius = 18; // Standard rounded corner radius
    const pointyRadius = 4;   // Smaller radius for the "tail" corner

    if (hasTail) { // This message is the first in a continuous block (chronologically oldest)
      if (isOwnMessage) {
        // Outgoing message: tail at top-right
        return {
          borderTopLeftRadius: defaultRadius,
          borderTopRightRadius: pointyRadius,
          borderBottomLeftRadius: defaultRadius,
          borderBottomRightRadius: defaultRadius,
        };
      } else {
        // Incoming message: tail at top-left
        return {
          borderTopLeftRadius: pointyRadius,
          borderTopRightRadius: defaultRadius,
          borderBottomLeftRadius: defaultRadius,
          borderBottomRightRadius: defaultRadius,
        };
      }
    } else {
      // Not the first message in its group, all corners are fully rounded
      return {
        borderRadius: defaultRadius,
      };
    }
  }, [hasTail, isOwnMessage]); // Recalculate if hasTail or isOwnMessage changes

  return (
    <View>
      {/* Reply indicator - right side (for left swipe) */}
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

      {/* Reply indicator - left side (for right swipe) */}
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

      <LongPressGestureHandler
        ref={longPressRef}
        onHandlerStateChange={handleLongPressStateChange}
        minDurationMs={400}
        enabled={canSelect && !isSelected}
        simultaneousHandlers={[panRef, tapRef]}
      >
        <Animated.View>
          <TapGestureHandler
            ref={tapRef}
            onHandlerStateChange={handleTapStateChange}
            simultaneousHandlers={[longPressRef, panRef]}
          >
            <Animated.View>
              <PanGestureHandler
                ref={panRef}
                onBegan={() => onGestureBegin(message.id)}
                onGestureEvent={(event) => onGestureUpdate(event, message.id)}
                onEnded={(event) => onGestureEnd(event, message)}
                onCancelled={(event) => onGestureEnd(event, message)}
                onFailed={(event) => onGestureEnd(event, message)}
                enabled={!isSelected && canSelect}
                activeOffsetX={[-20, 20]}
                failOffsetY={[-30, 30]}
                simultaneousHandlers={[longPressRef, tapRef]}
              >
                <Animated.View style={{ transform: [{ translateX: messageAnimation }] }}>
                  {/* Inline MessageBubble content */}
                  <View>
                    {isSelected && <View style={styles.selectedOverlay} />}

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
                            (isOwnMessage ? '#DCF8C6' : '#FFFFFF'),
                          ...bubbleBorderRadius, // Apply dynamic border radii here
                          // Adjust top margin for spacing between message groups
                          marginTop: hasTail ? 8 : 2, 
                          // Consistent small bottom margin for messages within a group
                          marginBottom: 2, 
                        }
                      ]}
                    >
                      {message.replyMessageId && (
                        <View
                          style={[
                            styles.replyPreview,
                            isOwnMessage ? styles.ownReplyPreview : styles.otherReplyPreview
                          ]}
                        >
                          <Text style={styles.replyName}>{message.replySenderName}</Text>
                          <Text style={styles.replyText} numberOfLines={1}>
                            {message.replyMessageText || 'Message'}
                          </Text>
                        </View>
                      )}

                      {/* CONDITIONAL SENDER NAME DISPLAY: Only for incoming messages that are the first in a block */}
                      {showSenderName && (
                        <Text style={styles.senderName}>
                          {message.senderName || "Unknown"}
                        </Text>
                      )}

                      {message.messageType === "text" && (
                        <Text style={styles.messageText}>
                          {message.messageText}
                        </Text>
                      )}

                      {message.messageType === "media" && (
                        <Text style={styles.messageText}>shared media file: {message.mediaFilesId}</Text>
                      )}
                      {message.messageType === "poll" && (
                        <Text style={styles.messageText}>shared poll: {message.pollId}</Text>
                      )}
                      {message.messageType === "table" && (
                        <Text style={styles.messageText}>shared table: {message.tableId}</Text>
                      )}
                      {message.messageType === "announcement" && (
                        <Text style={styles.messageText}>{message.messageText || "shared an announcement"}</Text>
                      )}

                      <View style={styles.metaRow}>
                        {message.isEdited && (
                          <Text style={styles.editedLabel}>edited</Text>
                        )}
                        <Text style={styles.timeText}>
                          {formatTime(message.createdAt || "")}
                        </Text>
                        {isOwnMessage && (
                          <View style={styles.statusContainer}>
                            <MessageStatus status={messageStatus} />
                          </View>
                        )}
                      </View>
                    </Animated.View>
                  </View>
                </Animated.View>
              </PanGestureHandler>
            </Animated.View>
          </TapGestureHandler>
        </Animated.View>
      </LongPressGestureHandler>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.messageText === nextProps.message.messageText &&
    prevProps.message.isEdited === nextProps.message.isEdited &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isGroupAdmin === nextProps.isGroupAdmin &&
    prevProps.selectedMessagesCount === nextProps.selectedMessagesCount &&
    prevProps.showSenderName === nextProps.showSenderName &&       // Update prop name in comparison
    prevProps.hasTail === nextProps.hasTail                         // Update prop name in comparison
  );
});

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

// MessageBubble is no longer needed as its content moved to MessageItem
// TelegramHeader component remains unchanged

// ==================== MAIN COMPONENT ====================

export default function ChatRoomScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { roomId } = useLocalSearchParams();
  
  // Socket context
  const {
    isConnected,
    user: socketUser,
    joinRoom,
    leaveRoom,
    sendMessage: socketSendMessage,
    requestOnlineUsers,
  } = useSocket();

  // Room state
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesSet, setMessagesSet] = useState<Set<string | number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{ userId: string; fullName: string | null } | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<ChatUser[]>([]);

  // Message selection state
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);

  // Modal states
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [activePollId, setActivePollId] = useState<number | null>(null);
  const [showTableModle, setShowTableModel] = useState(false);
  const [tableId, setTableId] = useState<number | null>(null);
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

  // Audio state
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  // Scheduled messages
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [showScheduledMessages, setShowScheduledMessages] = useState(false);

  // Scroll state
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Cache state
  const [isFromCache, setIsFromCache] = useState(false);
  const isInitialLoad = useRef(true);

  // Animation refs
  const blinkAnimations = useRef<Map<string | number, Animated.Value>>(new Map());
  const messageAnimations = useRef<Map<string | number, Animated.Value>>(new Map());
  const hapticTriggered = useRef<Map<string | number, boolean>>(new Map());
  const readSetRef = useRef<Set<number>>(new Set());

  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // ==================== PREPARED LIST DATA ====================

  const preparedListData = useMemo((): ChatListItem[] => {
    if (messages.length === 0) return [];

    const sortedMessages = [...messages].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

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

    const listData: ChatListItem[] = [];
    // Sort dates in descending order for inverted FlatList (newest date first)
    const dateKeys = Object.keys(grouped).sort((a, b) => {
      const firstMessageA = grouped[a][0];
      const firstMessageB = grouped[b][0];
      return new Date(firstMessageB.createdAt).getTime() - new Date(firstMessageA.createdAt).getTime();
    });

    dateKeys.forEach(date => {
      // Sort messages within each date in descending order (newest message first)
      const dateMessages = [...grouped[date]].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      dateMessages.forEach(msg => {
        listData.push({ ...msg, itemType: 'message' as const });
      });

      listData.push({
        itemType: 'dateSeparator' as const,
        date,
        id: `date-${date}`
      });
    });

    return listData;
  }, [messages]);

  // ==================== HELPER FUNCTIONS ====================

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

    if (dateString === todayIST) return "Today";
    if (dateString === yesterdayIST) return "Yesterday";
    return dateString;
  }, []);

  // Add message with deduplication
  const addMessage = useCallback((message: Message, updateCache: boolean = true) => {
    setMessagesSet(prev => {
      if (prev.has(message.id)) {
        console.log("⚠️ [ChatRoom] Duplicate message ignored:", message.id);
        return prev;
      }
      
      const newSet = new Set(prev);
      newSet.add(message.id);
      
      setMessages(prevMsgs => {
        const newMessages = [...prevMsgs, message];
        if (updateCache && roomId) {
          MessageStorage.addMessage(roomId as string, message);
        }
        return newMessages;
      });
      
      return newSet;
    });
  }, [roomId]);

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

const handleStartSelection = useCallback((message: Message) => {
  setSelectedMessages([message]);
}, []);

const handleSelectMessage = useCallback((message: Message) => {
  setSelectedMessages(prev => [...prev, message]);
}, []);

const handleDeselectMessage = useCallback((message: Message) => {
  setSelectedMessages(prev => prev.filter(msg => msg.id !== message.id));
}, []);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      setShowScrollToBottom(false);
    }
  }, [messages.length]);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    const isAtBottom = contentOffset.y < 100;
    setShowScrollToBottom(!isAtBottom && messages.length > 10);
  }, [messages.length]);

  const scrollToMessage = useCallback((messageId: string | number) => {
    const messageIndex = preparedListData.findIndex(item =>
      item.itemType === 'message' && item.id === messageId
    );

    if (messageIndex !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: messageIndex,
        animated: true,
        viewPosition: 0.5
      });

      const blinkAnimation = new Animated.Value(0);
      blinkAnimations.current.set(messageId, blinkAnimation);

      Animated.sequence([
        Animated.timing(blinkAnimation, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(blinkAnimation, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(blinkAnimation, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(blinkAnimation, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start(() => {
        blinkAnimations.current.delete(messageId);
      });
    }
  }, [preparedListData]);

  // ==================== DATA LOADING ====================

  const loadCachedMessages = useCallback(async (): Promise<boolean> => {
    if (!roomId) return false;

    try {
      const cachedData = await MessageStorage.getMessages(roomId as string);

      if (cachedData && cachedData.messages.length > 0) {
        console.log(`📦 [ChatRoom] Displaying ${cachedData.messages.length} cached messages`);
        setMessages(cachedData.messages);
        setMessagesSet(new Set(cachedData.messages.map(msg => msg.id)));
        setIsFromCache(true);
        setIsLoading(false);
        isInitialLoad.current = false;
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ [ChatRoom] Error loading cached messages:', error);
      return false;
    }
  }, [roomId]);

  const syncMessagesWithServer = useCallback(async (forceRefresh: boolean = false) => {
    if (!roomId) return;

    try {
      setIsSyncing(true);
      console.log('🔄 [ChatRoom] Syncing messages with server...');

      const token = await AuthStorage.getToken();
      const userData = await AuthStorage.getUser();
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}`, userId: userData?.seid },
      });

      if (response.data.isrestricted) {
        await logout();
        Alert.alert("Access denied", "You are not authorized to access this chat room.");
        router.replace({ pathname: "/(auth)/login", params: { from: "logout" } });
        return;
      }

      const freshMessages: Message[] = response.data.messages || [];

      const cachedData = await MessageStorage.getMessages(roomId as string);
      const cachedMessages = cachedData?.messages || [];

      const { newMessages, updatedMessages, deletedMessageIds, hasChanges } =
        MessageStorage.detectChanges(cachedMessages, freshMessages);

      if (hasChanges || forceRefresh) {
        console.log('✨ [ChatRoom] Changes detected, updating UI');

        if (deletedMessageIds.length > 0) {
          setMessagesSet(prev => {
            const newSet = new Set(prev);
            deletedMessageIds.forEach(id => newSet.delete(id));
            return newSet;
          });
          setMessages(prev => prev.filter(msg => !deletedMessageIds.includes(msg.id)));
        }

        if (updatedMessages.length > 0) {
          setMessages(prev => prev.map(msg => {
            const updated = updatedMessages.find(u => u.id === msg.id);
            return updated || msg;
          }));
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
      }

      setRoom(response.data);

      const initialMembers = response.data.members.map((member: ChatUser) => ({
        ...member,
        userId: String(member.userId),
        isOnline: false,
      }));
      setRoomMembers(initialMembers);

      if (userData) {
        const isUserGroupAdmin = response.data.members.some(
          (member: ChatUser) => member.userId === userData?.userId && member.isAdmin
        );
        setIsGroupAdmin(isUserGroupAdmin);
      }

      setIsFromCache(false);
    } catch (error) {
      console.error('❌ [ChatRoom] Error syncing:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [roomId]);

  const loadRoomDetails = useCallback(async (forceRefresh: boolean = false) => {
    try {
      const userData = await AuthStorage.getUser();
      if (userData) {
        setCurrentUser({
          userId: userData.userId,
          fullName: userData.fullName || null
        });
      }

      if (!forceRefresh) {
        const hasCachedData = await loadCachedMessages();
        if (hasCachedData) {
          syncMessagesWithServer(false);
          return;
        }
      }

      setIsLoading(true);

      const token = await AuthStorage.getToken();
      const response = await axios.get(`${API_URL}/api/chat/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.isrestricted) {
        await logout();
        ToastAndroid.show("Access denied", ToastAndroid.SHORT);
        router.replace({ pathname: "/(auth)/login", params: { from: "logout" } });
        return;
      }

      setRoom(response.data);
      console.log("response.data", response.data);
      const initialMessages = response.data.messages || [];
      setMessages(initialMessages);
      setMessagesSet(new Set(initialMessages.map((msg: Message) => msg.id)));

      await MessageStorage.saveMessages(roomId as string, initialMessages);

      const userData2 = await AuthStorage.getUser();
      const isUserGroupAdmin = response.data.members.some(
        (member: ChatUser) => member.userId === userData2?.userId && member.isAdmin
      );
      setIsGroupAdmin(isUserGroupAdmin);

      const initialMembers = response.data.members.map((member: ChatUser) => ({
        ...member,
        userId: String(member.userId),
        isOnline: false,
      }));
      setRoomMembers(initialMembers);

      loadScheduledMessages();

    } catch (error) {
      console.error("❌ [ChatRoom] Error loading room:", error);
      const hasCachedData = await loadCachedMessages();
      if (!hasCachedData) {
        alert("Failed to load chat room details");
      }
    } finally {
      setIsLoading(false);
      isInitialLoad.current = false;
    }
  }, [roomId, loadCachedMessages, syncMessagesWithServer]);

  const loadScheduledMessages = async () => {
    try {
      if (!roomId) return;
      const response = await getScheduledMessages(roomId as string);
      if (response.success) {
        setScheduledMessages(response.scheduledMessages);
      }
    } catch (error) {
      console.error("Error loading scheduled messages:", error);
    }
  };

  // ==================== SOCKET SUBSCRIPTIONS ====================

  // Handle new messages
  const handleNewMessage = useCallback((message: ChatMessage) => {
    console.log("📨 [ChatRoom] New message received:", message.id);
    
    // Don't add own messages (they're added optimistically)
    if (currentUser && message.senderId !== currentUser.userId) {
      const newMessage: Message = {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        messageText: message.messageText,
        messageType: message.messageType,
        createdAt: message.createdAt,
        mediaFilesId: message.mediaFilesId,
        pollId: message.pollId,
        tableId: message.tableId,
        replyMessageId: message.replyMessageId,
      };
      console.log("newMessage", newMessage);
      addMessage(newMessage, true);
    }
  }, [currentUser?.userId, addMessage]);

  // Handle message edited
  const handleMessageEdited = useCallback((data: MessageEditedEvent) => {
    console.log("✏️ [ChatRoom] Message edited:", data.messageId);
    updateMessageFields(data.messageId, {
      messageText: data.messageText,
      isEdited: data.isEdited,
      editedAt: data.editedAt,
    });
  }, [updateMessageFields]);

  // Handle messages deleted
  const handleMessagesDeleted = useCallback((data: MessagesDeletedEvent) => {
    console.log("🗑️ [ChatRoom] Messages deleted:", data.messageIds);
    data.messageIds.forEach((id) => removeMessage(id, true));
  }, [removeMessage]);

  // Handle online users
  const handleOnlineUsers = useCallback((data: OnlineUsersUpdate) => {
    setOnlineUsers(data.users);
  }, []);

  // Handle room members
  const handleRoomMembers = useCallback((data: { roomId: string; members: MemberInfo[] }) => {
    setRoomMembers(data.members.map(m => ({
      ...m,
      userId: String(m.userId),
    })));
  }, []);

  // Subscribe to room events using hook
  useChatRoomSubscription({
    roomId: roomId as string,
    onNewMessage: handleNewMessage,
    onMessageEdited: handleMessageEdited,
    onMessagesDeleted: handleMessagesDeleted,
    onOnlineUsers: handleOnlineUsers,
    onRoomMembers: handleRoomMembers,
  });

  // Clear notifications when entering room
  useEffect(() => {
    if (roomId && isConnected) {
      clearRoomNotifications(roomId as string);
    }
  }, [roomId, isConnected]);

  // ==================== FOCUS EFFECT ====================

  const hasFocusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // console.log("useFocusEffect calling");
      if (roomId && !hasFocusedOnce.current) {
        // console.log("useFocusEffect calling 2");
        hasFocusedOnce.current = true; //this is causing the issue for media grid messages send
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

  // ==================== BACK HANDLER ====================

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

  // ==================== MESSAGE ACTIONS ====================

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

    if ((!text.trim() && !mediaFilesId && !pollId && !tableId) || !roomId || !currentUser || sending) return;

    const trimmedMessage = text.trim();

    try {
      setSending(true);
      setIsReplying(false);
      setMessageText("");

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
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

      // Add optimistic message
      addMessage(optimisticMessage, false);

      const token = await AuthStorage.getToken();
      const response = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        {
          messageText: trimmedMessage,
          mediaFilesId,
          pollId,
          messageType,
          tableId,
          replyMessageId,
          scheduledAt
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.scheduledMessage) {
        loadScheduledMessages();
        // Remove optimistic message for scheduled
        removeMessage(tempId, false);
        return;
      }

      const newMessages = Array.isArray(response.data) ? response.data : [response.data];

      // Replace optimistic message with real message
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== tempId);
        const withSenderName = newMessages.map((msg: Message) => ({
          ...msg,
          senderName: currentUser.fullName || "You",
          ...(replyMessageId && replyToMessage && {
            replySenderName: replyToMessage.senderName,
            replyMessageText: replyToMessage.messageText,
            replyMessageType: replyToMessage.messageType
          })
        }));
        const allMessages = [...filtered, ...withSenderName];
        MessageStorage.saveMessages(roomId as string, allMessages);
        return allMessages;
      });

      setMessagesSet(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        newMessages.forEach((msg: Message) => newSet.add(msg.id));
        return newSet;
      });

      // Emit via socket
      newMessages.forEach((msg: Message) => {
        socketSendMessage(roomId as string, {
          id: msg.id,
          messageText: msg.messageText,
          createdAt: msg.createdAt,
          messageType: msg.messageType,
          mediaFilesId: msg.mediaFilesId,
          pollId: msg.pollId,
          tableId: msg.tableId,
          replyMessageId: msg.replyMessageId,
        });
      });

      setReplyToMessage(null);

    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
      setMessageText(trimmedMessage);
      
      // Remove failed optimistic message
      setMessages(prev => prev.filter(msg => typeof msg.id !== 'string' || !msg.id.includes('temp')));
      setMessagesSet(prev => {
        const newSet = new Set(prev);
        for (const id of newSet) {
          if (typeof id === 'string' && id.includes('temp')) {
            newSet.delete(id);
          }
        }
        return newSet;
      });
    } finally {
      setSending(false);
    }
  };

  // ==================== SELECTION & REPLY ====================

  const isMessageSelected = useCallback((messageId: string | number) => {
    return selectedMessages.some(msg => msg.id === messageId);
  }, [selectedMessages]);

  const handleMessageLongPress = useCallback((message: Message) => {
    console.log("on long press calling", { isGroupAdmin, messageSenderId: message.senderId, currentUserId: currentUser?.userId });
    
    // Admin can select any message, non-admin can only select their own messages
    const canSelect = isGroupAdmin || (currentUser && message.senderId === currentUser.userId);
    
    if (!canSelect) {
      console.log("Cannot select: not admin and not own message");
      return;
    }
    
    if (selectedMessages.length === 0) {
      setSelectedMessages([message]);
    } else if (!isMessageSelected(message.id)) {
      setSelectedMessages(prev => [...prev, message]);
    }
  }, [isGroupAdmin, currentUser, selectedMessages, isMessageSelected]);

  const handleMessagePress = useCallback((message: Message) => {
    // Only handle selection if messages are already selected
    if (selectedMessages.length === 0) return;
    
    // Admin can select any message, non-admin can only select their own messages
    const canSelect = isGroupAdmin || (currentUser && message.senderId === currentUser.userId);
    
    if (!canSelect) return;
    
    if (isMessageSelected(message.id)) {
      setSelectedMessages(prev => prev.filter(msg => msg.id !== message.id));
    } else {
      setSelectedMessages(prev => [...prev, message]);
    }
  }, [isGroupAdmin, currentUser, selectedMessages, isMessageSelected]);

  const clearSelection = () => {
    setSelectedMessages([]);
  };

  const handleStartReply = (message: Message) => {
    setReplyToMessage(message);
    setIsReplying(true);
    setSelectedMessages([]);
  };

  const handleReplyPreviewClick = useCallback((messageId: string | number) => {
    scrollToMessage(messageId);
  }, [scrollToMessage]);

  const handleCancelReply = () => {
    setReplyToMessage(null);
    setIsReplying(false);
  };

  // ==================== GESTURE HANDLING ====================

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
    }

    Animated.spring(animation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  // ==================== OTHER HANDLERS ====================

  const handleMediaGridPress = (mediaFiles: any[], selectedIndex: number) => {
    setSelectedMediaFiles(mediaFiles);
    setSelectedMediaIndex(selectedIndex);
    setShowMediaViewer(true);
  };

  const onMessageEditedFromOptions = (editedMessage: Message) => {
    updateMessageFields(editedMessage.id, editedMessage);
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
      console.error('Error marking message as read:', error);
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
      console.error('Error fetching read status:', error);
    } finally {
      setIsLoadingReadStatus(false);
    }
  };

  const handleInfoPress = (message: Message) => {
    setSelectedMessageForReadStatus(message);
    setShowReadStatus(true);
    fetchReadStatus(message.id);
  };

  const handleForwardMessages = async (selectedRooms: ChatRoom[], messagesToForward: Message[]) => {
    for (const room of selectedRooms) {
      if (!room.roomId) continue;
      for (const message of messagesToForward) {
        try {
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

          if (currentUser && response.data) {
            socketSendMessage(room.roomId.toString(), {
              id: response.data.id,
              messageText: message.messageText || "",
              createdAt: response.data.createdAt,
              messageType: message.messageType,
              mediaFilesId: message.mediaFilesId,
              pollId: message.pollId,
              tableId: message.tableId
            });
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error forwarding to room ${room.roomName}:`, error);
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
      console.error('Error deleting messages:', error);
      throw error;
    }
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (!currentUser) return;
    viewableItems.forEach((item: any) => {
      const message = item.item;
      if (message && message.itemType === 'message' && message.senderId !== currentUser.userId && typeof message.id === 'number') {
        markMessageAsRead(message.id);
      }
    });
  }, [currentUser, markMessageAsRead]);

  const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

  // ==================== RENDER ITEM ====================

  const renderItem = useCallback(({ item, index }: { item: ChatListItem, index: number }) => {
    if (item.itemType === 'dateSeparator') {
      return <DateSeparator dateString={item.date} formatDateForDisplay={formatDateForDisplay} />;
    }
  
    const message = item as Message & { itemType: 'message' };
    const isOwnMessage = message.senderId === currentUser?.userId;
    const isSelected = isMessageSelected(message.id);
    const messageAnimation = getMessageAnimation(message.id);
    const blinkAnimation = blinkAnimations.current.get(message.id);

    // Determine if this message should have a "tail" (pointy corner)
    // This happens if it's the chronologically oldest message in a continuous block from the same sender.
    // In an INVERTED FlatList, the chronologically oldest message has a higher index.
    let hasTail = false;
    if (index === preparedListData.length - 1) { // This is the very first message in the list chronologically
        hasTail = true;
    } else {
        const chronologicallyPreviousItem = preparedListData[index + 1]; // Next item in inverted list is previous chronologically
        if (chronologicallyPreviousItem.itemType === 'message') {
            if ((chronologicallyPreviousItem as Message).senderId !== message.senderId) {
                hasTail = true; // Previous message was from a different sender, so this one starts a new block
            }
        } else if (chronologicallyPreviousItem.itemType === 'dateSeparator') {
            hasTail = true; // Previous item was a date separator, so this one starts a new block
        }
    }

    // Only show sender name inside the bubble for INCOMING messages, and only if it starts a new block (has a tail).
    let showSenderName = false;
    if (!isOwnMessage && hasTail) {
      showSenderName = true;
    }
  
    return (
      <MessageItem
        message={message}
        isOwnMessage={isOwnMessage}
        isSelected={isSelected}
        isGroupAdmin={isGroupAdmin}
        currentUser={currentUser}
        selectedMessagesCount={selectedMessages.length}
        messageAnimation={messageAnimation}
        blinkAnimation={blinkAnimation}
        showSenderName={showSenderName} // Pass whether to show sender name
        hasTail={hasTail}               // Pass whether it should have a tail for border radius and margin
        onSelect={handleSelectMessage}
        onDeselect={handleDeselectMessage}
        onStartSelection={handleStartSelection}
        onGestureBegin={handleGestureBegin}
        onGestureUpdate={handleGestureUpdate}
        onGestureEnd={handleGestureEnd}
        onReplyPreviewClick={handleReplyPreviewClick}
        formatTime={formatISTTime}
      />
    );
  }, [
    preparedListData, // Add this to dependencies because we access preparedListData[index + 1]
    currentUser, 
    selectedMessages.length, 
    formatDateForDisplay, 
    isGroupAdmin, 
    isMessageSelected,
    handleSelectMessage,
    handleDeselectMessage,
    handleStartSelection,
    handleGestureBegin,
    handleGestureUpdate,
    handleGestureEnd,
    handleReplyPreviewClick,
    getMessageAnimation,
  ]);
  const keyExtractor = useCallback((item: ChatListItem) => {
    if (item.itemType === 'dateSeparator') return item.id;
    return `msg-${(item as Message).id}`;
  }, []);

  // ==================== LOADING STATE ====================

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

      <TouchableOpacity onPress={onMenuPress} style={styles.headerContent}>
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

      {onAvatarPress && (
        <TouchableOpacity onPress={onAvatarPress} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color="#000" />
        </TouchableOpacity>
      )}
    </View>
  );
});
  // ==================== MAIN RENDER ====================

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {/* Header */}
          {selectedMessages.length > 0 ? (
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
              onMessageEdited={onMessageEditedFromOptions}
            />
          ) : (
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
          )}

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={preparedListData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            extraData={[isGroupAdmin, selectedMessages]}
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
              setTimeout(() => {
                if (flatListRef.current && preparedListData.length > 0) {
                  flatListRef.current.scrollToIndex({
                    index: Math.min(info.index, preparedListData.length - 1),
                    animated: true,
                  });
                }
              }, 500);
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

          {/* Scroll to bottom button */}
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
                      <Text style={{ fontSize: 14, color: '#666' }} numberOfLines={1} ellipsizeMode="tail">
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
                  sendMessage(text, messageType, undefined, undefined, undefined, replyToMessage?.id as number, scheduledAt);
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
              padding: 10,
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
              isOnline: onlineUsers.includes(member.userId),
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

          {showTableModle && tableId !== null && currentUser?.userId && (
            <RenderTable tableId={tableId} visible={showTableModle} setShowTable={setShowTableModel} />
          )}

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
                <TouchableOpacity onPress={() => selectedMessageForReadStatus && fetchReadStatus(selectedMessageForReadStatus.id)} disabled={isLoadingReadStatus} className="p-2">
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
                  </View>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </Modal>

          <AudioRecorder
            isVisible={showAudioRecorder}
            onRecordingComplete={() => {}}
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
                      <Text className="text-base text-gray-900 mb-2">{message.messageText}</Text>
                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={16} color="#6b7280" />
                        <Text className="text-sm text-gray-600 ml-1">
                          Scheduled for {formatISTDate(message.scheduledAt)}
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

// ==================== STYLES ====================

const styles = StyleSheet.create({
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
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    marginHorizontal: 8,
    // Note: marginVertical and borderRadius properties are now set dynamically in MessageItem for granular control
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ownBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
    // Removed specific border radius from here, now handled dynamically in MessageItem
    marginLeft: 60,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    // Removed specific border radius from here, now handled dynamically in MessageItem
    marginRight: 60,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 136, 204, 0.15)',
    marginHorizontal: -16, // Extend overlay slightly to cover potential tail area
  },
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
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0088CC',
    marginBottom: 4, // Added a small margin-bottom for better spacing from message text
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000',
  },
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
  chatContainer: {
    flex: 1,
    backgroundColor: '#E5DDD5',
  },
  listContent: {
    paddingVertical: 8,
  },
});



