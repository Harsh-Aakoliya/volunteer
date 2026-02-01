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
  BackHandler,
  ScrollView,
  Animated,
  Modal,
  ToastAndroid,
  LayoutAnimation,
  UIManager,
  EmitterSubscription,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
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
import VideoCallNotification from "@/components/chat/VideoCallNotification";
import GlobalPollModal from "@/components/chat/GlobalPollModal";
import RenderTable from "@/components/chat/Attechments/RenderTable";
import MediaViewerModal from "@/components/chat/MediaViewerModal";
import ChatMessageOptions from "@/components/chat/ChatMessageOptions";
import MessageInput from "@/components/chat/MessageInput";
import AudioRecorder from "@/components/chat/AudioRecorder";
import AudioMessagePlayer from "@/components/chat/AudioMessagePlayer";
import MediaGrid from "@/components/chat/MediaGrid";
import { clearRoomNotifications } from "@/utils/chatNotificationHandler";
import { getScheduledMessages } from "@/api/chat";
import { logout } from '@/api/auth';
import { useSocket, useChatRoomSubscription } from '@/contexts/SocketContext';
// import StyledTextMessage from "@/components/chat/StyledTextMessage";
import { 
  ChatMessage, 
  MessageEditedEvent, 
  MessagesDeletedEvent, 
  OnlineUsersUpdate,
  MemberInfo 
} from '@/utils/socketManager';
import socketManager from '@/utils/socketManager';
import PollMessage from '@/components/chat/PollMessage';
import { useVideoCall } from '@/contexts/VideoCallContext';
import RenderHtml from 'react-native-render-html';
import { Dimensions } from 'react-native';
import { getReplyPreviewText } from '@/utils/messageHelpers';

// ==================== TYPES ====================

interface RoomDetails extends ChatRoom {
  members: ChatUser[];
  messages: Message[];
}

type ChatListItem =
  | (Message & { itemType: 'message' })
  | { itemType: 'dateSeparator'; date: string; id: string };

// ==================== MEMOIZED COMPONENTS ====================

// Imports
import { useWindowDimensions } from 'react-native';
import { defaultSystemFonts } from 'react-native-render-html';
import { Path, Svg } from 'react-native-svg';
// Add 'sans-serif' for Android Bold/Italic support
const systemFonts = [...defaultSystemFonts, 'sans-serif', 'sans-serif-medium'];

const StyledTextMessage = React.memo(({ 
  content, 
  isOwnMessage 
}: { 
  content: string, 
  isOwnMessage: boolean 
}) => {
  const { width } = useWindowDimensions();
  const contentWidth = width * 0.75; 

  const cleanContent = useMemo(() => {
    if (!content) return "";
    return content.trim();
  }, [content]);

  // Check if HTML
  const isHTML = /<[a-z][\s\S]*>/i.test(cleanContent);
  
  if (!isHTML) {
    return (
      <Text className="text-base leading-[22px] text-black">
        {cleanContent}
      </Text>
    );
  }

  // Define defaults
  const defaultTextColor = '#000000';
  const linkColor = isOwnMessage ? '#0000FF' : '#0088CC';

  return (
    <View>
      <RenderHtml
        contentWidth={contentWidth}
        source={{ html: cleanContent }}
        systemFonts={systemFonts}
        
        // 1. Base style for root elements
        baseStyle={{
          fontSize: 16,
          lineHeight: 22,
          color: defaultTextColor,
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
        }}
        
        // 2. Specific Tag Styling
        tagsStyles={{
          body: { margin: 0, padding: 0 },
          p: { marginTop: 0, marginBottom: 4 },
          div: { marginTop: 0, marginBottom: 0 },
          
          // Bold/Italic
          b: { fontWeight: '700' },
          strong: { fontWeight: '700' },
          i: { fontStyle: 'italic' },
          em: { fontStyle: 'italic' },
          
          // Links
          a: { color: linkColor, textDecorationLine: 'underline' },
          
          // Lists
          ul: { paddingLeft: 20, marginTop: 4, marginBottom: 4 },
          ol: { paddingLeft: 20, marginTop: 4, marginBottom: 4 },
          li: { marginBottom: 2 },

          // CRITICAL FOR BACKGROUND COLOR:
          // Ensure span behaves like text so background color wraps tightly
          span: { }, 
        }}
        
        // 3. Ensure inline styles (style="color: red; background-color: blue") take priority
        defaultTextProps={{
          textBreakStrategy: 'simple',
        }}
      />
    </View>
  );
});

const MessageItem = React.memo(({
  message,
  isOwnMessage,
  isSelected,
  isGroupAdmin,
  canSendMessage,
  currentUser,
  totalMembers,
  selectedMessagesCount,
  messageAnimation,
  isHighlighted,
  showSenderName,
  hasTail,
  onSelect,
  onDeselect,
  onStartSelection,
  onGestureBegin,
  onGestureUpdate,
  onGestureEnd,
  onReplyPreviewClick,
  formatTime,
  handleMediaGridPress
}: {
  message: Message;
  isOwnMessage: boolean;
  isSelected: boolean;
  isGroupAdmin: boolean;
  canSendMessage: boolean;
  currentUser: { userId: string; fullName: string | null } | null;
  totalMembers: number;
  selectedMessagesCount: number;
  messageAnimation: Animated.Value;
  isHighlighted: boolean;
  showSenderName: boolean;
  hasTail: boolean;
  onSelect: (message: Message) => void;
  onDeselect: (message: Message) => void;
  onStartSelection: (message: Message) => void;
  onGestureBegin: (messageId: string | number) => void;
  onGestureUpdate: (event: any, messageId: string | number) => void;
  onGestureEnd: (event: any, message: Message) => void;
  onReplyPreviewClick: (id: string | number) => void;
  formatTime: (date: string) => string;
  handleMediaGridPress:any;
}) => {
  const longPressRef = useRef(null);
  const panRef = useRef(null);
  const tapRef = useRef(null);

  // Permission check for selection:
  // - Admin can select any message
  // - Can send message users can only select their own messages
  // - Cannot send message users cannot select any message
  const canSelect = isGroupAdmin || (canSendMessage && isOwnMessage);

  // Permission check for reply:
  // - Admin can reply to any message
  // - Can send message users can reply to any message
  // - Cannot send message users cannot reply to any message
  const canReply = isGroupAdmin || canSendMessage;

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
    const defaultRadius = 18;
    const pointyRadius = 4;

    if (hasTail) {
      if (isOwnMessage) {
        return {
          borderTopLeftRadius: defaultRadius,
          borderTopRightRadius: pointyRadius,
          borderBottomLeftRadius: defaultRadius,
          borderBottomRightRadius: defaultRadius,
        };
      } else {
        return {
          borderTopLeftRadius: pointyRadius,
          borderTopRightRadius: defaultRadius,
          borderBottomLeftRadius: defaultRadius,
          borderBottomRightRadius: defaultRadius,
        };
      }
    } else {
      return {
        borderRadius: defaultRadius,
      };
    }
  }, [hasTail, isOwnMessage]);

  return (
    <View>
      {/* Highlight overlay behind the message (shown when scrolling to reply) */}
      {isHighlighted && (
        <View className="absolute inset-0 bg-black/15 -mx-4" />
      )}

      {/* Reply indicator - right side (for left swipe) */}
      <Animated.View
        className="absolute top-0 bottom-0 right-4 justify-center"
        style={{
          opacity: messageAnimation.interpolate({
            inputRange: [-80, -30, 0],
            outputRange: [1, 0.5, 0],
            extrapolate: 'clamp',
          }),
        }}
      >
        <View className="bg-[#0088CC] rounded-full p-2">
          <Ionicons name="arrow-undo" size={20} color="white" />
        </View>
      </Animated.View>

      {/* Reply indicator - left side (for right swipe) */}
      <Animated.View
        className="absolute top-0 bottom-0 left-4 justify-center"
        style={{
          opacity: messageAnimation.interpolate({
            inputRange: [0, 30, 80],
            outputRange: [0, 0.5, 1],
            extrapolate: 'clamp',
          }),
        }}
      >
        <View className="bg-[#0088CC] rounded-full p-2">
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
                enabled={!isSelected && canReply}
                activeOffsetX={[-20, 20]}
                failOffsetY={[-30, 30]}
                simultaneousHandlers={[longPressRef, tapRef]}
              >
                <Animated.View style={{ transform: [{ translateX: messageAnimation }] }}>
                  {/* Inline MessageBubble content */}
                  <View>
                    {isSelected && <View className="absolute inset-0 bg-[#0088CC]/15 -mx-4" />}

                    <Animated.View
                      className={`max-w-[75%] px-3 pt-2 pb-1.5 mx-2 shadow-sm ${
                        isOwnMessage 
                          ? 'self-end bg-[#DCF8C6] ml-[60px]' 
                          : 'self-start bg-white mr-[60px]'
                      }`}
                      style={[
                        {
                          ...bubbleBorderRadius,
                          marginTop: hasTail ? 8 : 2, 
                          marginBottom: 2, 
                        }
                      ]}
                    >
                      {message.replyMessageId && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => onReplyPreviewClick(message.replyMessageId!)}
                        >
                          <View
                            className={`py-1.5 px-2.5 mb-1.5 rounded-lg border-l-[3px] ${
                              isOwnMessage 
                                ? 'bg-black/5 border-l-[#4CAF50]' 
                                : 'bg-black/5 border-l-[#0088CC]'
                            }`}
                          >
                            <Text className="text-xs font-semibold text-[#0088CC] mb-0.5">
                              {message.replySenderName}
                            </Text>
                            <Text
                              className="text-[13px] text-[#666]"
                              numberOfLines={3}
                              ellipsizeMode="tail"
                            >
                              {getReplyPreviewText({
                                messageType: message.replyMessageType,
                                messageText: message.replyMessageText,
                              } as Message)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      {/* CONDITIONAL SENDER NAME DISPLAY */}
                      {showSenderName && (
                        <Text className="text-[13px] font-semibold text-[#0088CC] mb-1">
                          {message.senderName || "Unknown"}
                        </Text>
                      )}

                        {message.messageType === "text" && (
                          <StyledTextMessage 
                            content={message.messageText} 
                            isOwnMessage={isOwnMessage}
                          />
                        )}

                        {message.messageType === "media" && (
                          <View>
                            <MediaGrid 
                              messageId={message.id}
                              onMediaPress={handleMediaGridPress}
                              mediaFilesId={message.mediaFilesId || 0}
                              isOwnMessage
                            />
                            {message.messageText && message.messageText.trim() !== "" && (
                              <View className="mt-1">
                                <StyledTextMessage
                                  content={message.messageText}
                                  isOwnMessage={isOwnMessage}
                                />
                              </View>
                            )}
                          </View>
                        )}

                        {message.messageType === "poll" && (
                          <View>
                            {typeof message.pollId === "number" && (
                              <PollMessage
                                pollId={message.pollId}
                                currentUserId={currentUser?.userId || ""}
                                onViewResults={(pollId) => {
                                  router.push({
                                    pathname: "/chat/poll-votes",
                                    params: {
                                      pollId: String(pollId),
                                      totalMembers: String(totalMembers),
                                      currentUserId: String(currentUser?.userId || ""),
                                    },
                                  });
                                }}
                              />
                            )}
                            {message.messageText && message.messageText.trim() !== "" && (
                              <View className="mt-1">
                                <StyledTextMessage
                                  content={message.messageText}
                                  isOwnMessage={isOwnMessage}
                                />
                              </View>
                            )}
                          </View>
                        )}
                      {/* {message.messageType === "poll" && message.pollId && (
                        <PollMessage
                          pollId={message.pollId}
                          currentUserId={currentUser?.userId || ''}
                          isOwnMessage={isOwnMessage}
                          onViewResults={(pollId) => {
                            console.log("view results for poll", pollId);
                          }}
                        />
                      )} */}
                      {message.messageType === "table" && (
                        <Text className="text-base leading-[22px] text-black">
                          shared table: {message.tableId}
                        </Text>
                      )}
                      {message.messageType === "announcement" && (
                        <Text className="text-base leading-[22px] text-black">
                          {message.messageText || "shared an announcement"}
                        </Text>
                      )}

                      <View className="flex-row items-center justify-end mt-1 gap-1">
                        {message.isEdited && (
                          <Text className="text-[11px] text-[#8E8E93] italic">edited</Text>
                        )}
                        <Text className="text-[11px] text-[#8E8E93]">
                          {formatTime(message.createdAt || "")}
                        </Text>
                        {isOwnMessage && (
                          <View className="ml-0.5">
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
    prevProps.canSendMessage === nextProps.canSendMessage &&
    prevProps.selectedMessagesCount === nextProps.selectedMessagesCount &&
    prevProps.showSenderName === nextProps.showSenderName &&
    prevProps.hasTail === nextProps.hasTail &&
    prevProps.isHighlighted === nextProps.isHighlighted
  );
});

const DateSeparator = React.memo(({ dateString, formatDateForDisplay }: {
  dateString: string;
  formatDateForDisplay: (date: string) => string;
}) => (
  <View className="items-center my-4">
    <View className="bg-[#FDFCFA] px-3 py-1.5 rounded-xl">
      <Text className="text-[13px] font-medium text-[#666]">
        {formatDateForDisplay(dateString)}
      </Text>
    </View>
  </View>
));

// ==================== MAIN COMPONENT ====================

export default function ChatRoomScreen() {
  const { roomId, roomName: paramRoomName, canSendMessage: paramCanSendMessage } = useLocalSearchParams();
  const { initiateCall } = useVideoCall();

  
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
  // Initialize from params, will be updated when server data arrives
  const [displayRoomName, setDisplayRoomName] = useState<string>(
    (Array.isArray(paramRoomName) ? paramRoomName[0] : paramRoomName) || "Chat"
  );
  const [canSendMessage, setCanSendMessage] = useState<boolean>(
    paramCanSendMessage === "true" || paramCanSendMessage === "1"
  );
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{ userId: string; fullName: string | null } | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<ChatUser[]>([]);

  // Message selection state
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);

  // Modal states
  const [showPollModal, setShowPollModal] = useState(false);
  const [activePollId, setActivePollId] = useState<number | null>(null);
  const [showTableModle, setShowTableModel] = useState(false);
  const [tableId, setTableId] = useState<number | null>(null);

  // Reply state
  const [isReplying, setIsReplying] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  // Audio state
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  // Scheduled messages
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [showScheduledMessages, setShowScheduledMessages] = useState(false);

  // Video call notification state
  const [showVideoCallNotification, setShowVideoCallNotification] = useState(false);
  const [videoCallData, setVideoCallData] = useState<{ callerId: string; callerName: string } | null>(null);

  // Attachment sheet removed - using router-based approach

  // Scroll state
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Cache state
  const [isFromCache, setIsFromCache] = useState(false);
  const isInitialLoad = useRef(true);

  // Animation refs
  const messageAnimations = useRef<Map<string | number, Animated.Value>>(new Map());
  const hapticTriggered = useRef<Map<string | number, boolean>>(new Map());
  const readSetRef = useRef<Set<number>>(new Set());
  
  // Highlighted message for reply scroll
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | number | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // Media viewer modal states
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<any[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  // ==================== PREPARED LIST DATA ====================

  const preparedListData = useMemo((): ChatListItem[] => {
    if (messages.length === 0) return [];

    // Sort messages: temp/optimistic messages should always appear at the end
    const sortedMessages = [...messages].sort((a, b) => {
      const aIsTemp = typeof a.id === 'string' && a.id.startsWith('temp-');
      const bIsTemp = typeof b.id === 'string' && b.id.startsWith('temp-');
      
      // If both are temp or both are not temp, sort by createdAt
      if (aIsTemp === bIsTemp) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      
      // Temp messages go after non-temp messages
      return aIsTemp ? 1 : -1;
    });

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

  // Add message with deduplication and smooth animation
  const addMessage = useCallback((message: Message, updateCache: boolean = true) => {
    setMessagesSet(prev => {
      if (prev.has(message.id)) {
        console.log("⚠️ [ChatRoom] Duplicate message ignored:", message.id);
        return prev;
      }
      
      const newSet = new Set(prev);
      newSet.add(message.id);
      
      // Trigger smooth layout animation
      LayoutAnimation.configureNext({
        duration: 200,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });
      
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
  
  // Expose scrollToBottom for use in sendMessage
  const scrollToBottomRef = useRef(scrollToBottom);
  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom]);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // For inverted list, we're at bottom when contentOffset.y is near 0
    // But we need to account for the content size
    const scrollPosition = contentOffset.y;
    const contentHeight = contentSize.height;
    const viewHeight = layoutMeasurement.height;
    // If we're scrolled up more than 200px from the bottom (which is offset 0 in inverted list)
    const isAtBottom = scrollPosition < 200;
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

      // Show highlight overlay for 1 second
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1000);
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

      // Update roomName and canSendMessage from server response
      if (response.data.roomName) {
        setDisplayRoomName(response.data.roomName);
      }
      if (response.data.canSendMessage !== undefined) {
        setCanSendMessage(Boolean(response.data.canSendMessage));
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

      // Update roomName and canSendMessage from server response
      if (response.data.roomName) {
        setDisplayRoomName(response.data.roomName);
      }
      if (response.data.canSendMessage !== undefined) {
        setCanSendMessage(Boolean(response.data.canSendMessage));
      }

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
    if (currentUser && (message.messageType === "media" || message.messageType === "poll" || message.messageType === "table" || message.messageType === "announcement" || message.messageType === "text")) {
      console.log("message received in chat room", message, message.senderId, currentUser?.userId);
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
        replySenderName: message.replySenderName,
        replyMessageText: message.replyMessageText,
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

  // Handle video call initiation notification
  useEffect(() => {
    if (!isConnected || !roomId) return;

    const videoCallInitSub = socketManager.on('video-call-initiate', (data: any) => {
      if (data.roomId === (Array.isArray(roomId) ? roomId[0] : roomId) && data.callerId !== currentUser?.userId) {
        console.log('📹 Video call initiated by:', data.callerName);
        setVideoCallData({
          callerId: data.callerId,
          callerName: data.callerName,
        });
        setShowVideoCallNotification(true);
      }
    });

    return () => {
      socketManager.off(videoCallInitSub);
    };
  }, [isConnected, roomId, currentUser?.userId]);

  // Handle video call acceptance
  const handleAcceptVideoCall = useCallback(() => {
    setShowVideoCallNotification(false);
    router.push({
      pathname: '/chat/video-call',
      params: { 
        roomId: Array.isArray(roomId) ? roomId[0] : roomId,
        joining: 'true', // Mark that this user is joining an existing call
      },
    });
  }, [roomId, router]);

  // Handle video call rejection
  const handleRejectVideoCall = useCallback(() => {
    setShowVideoCallNotification(false);
    if (roomId) {
      socketManager.rejectVideoCall(Array.isArray(roomId) ? roomId[0] : roomId);
    }
    setVideoCallData(null);
  }, [roomId]);

  // Focus handlers
  const handleMainInputFocus = useCallback(() => {}, []);
  const handleMainInputBlur = useCallback(() => {}, []);


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

  // Mark all messages as read whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        // Use a small timeout so markAllMessagesAsReadInRoom is defined
        setTimeout(() => {
          // @ts-ignore - function is defined later in the component
          markAllMessagesAsReadInRoom && markAllMessagesAsReadInRoom();
        }, 0);
      }
    }, [roomId])
  );

  // ==================== BACK HANDLER ====================
  useEffect(() => {
    const onBackPress = () => {
      if (selectedMessages.length > 0) {
        clearSelection();
        return true;
      }
  
      if (router.canGoBack()) {
        router.back();              // normal flow
      } else {
        router.replace("/(drawer)"); // notification / cold start
      }
  
      return true;
    };
  
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
  
    return () => sub.remove();
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
    if (!canSendMessage) {
      alert("You don't have permission to send messages in this room.");
      return;
    }

    if ((!text.trim() && !mediaFilesId && !pollId && !tableId) || !roomId || !currentUser || sending) return;

    const trimmedMessage = text.trim();

    try {
      setSending(true);
      setIsReplying(false);
      setMessageText("");

      const tempId = `temp-${Date.now()}`;
      
      // Format reply text based on message type using utility function
      let formattedReplyText = '';
      if (replyToMessage) {
        formattedReplyText = getReplyPreviewText(replyToMessage);
      }
      
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
          replyMessageText: formattedReplyText,
          replyMessageType: replyToMessage.messageType
        })
      };

      // Add optimistic message
      addMessage(optimisticMessage, false);
      
      // Auto-scroll to bottom after adding optimistic message
      setTimeout(() => {
        scrollToBottomRef.current();
      }, 100);

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

      // Emit via socket - include reply preview fields for other users
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
          replySenderName: msg.replySenderName || replyToMessage?.senderName,
          replyMessageText: msg.replyMessageText || formattedReplyText,
          replyMessageType: msg.replyMessageType || replyToMessage?.messageType,
        });
      });

      setReplyToMessage(null);

      // After successfully sending, mark all messages in this room as read for the sender
      markAllMessagesAsReadInRoom();

      // Auto-scroll to bottom after message is sent successfully
      setTimeout(() => {
        scrollToBottomRef.current();
      }, 200);

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
    console.log("on long press calling", { isGroupAdmin, canSendMessage, messageSenderId: message.senderId, currentUserId: currentUser?.userId });
    
    // Permission check:
    // - Admin can select any message
    // - Can send message users can only select their own messages
    // - Cannot send message users cannot select any message
    if (!canSendMessage && !isGroupAdmin) {
      console.log("Cannot select: user cannot send messages");
      return;
    }
    
    const canSelect = isGroupAdmin || (canSendMessage && currentUser && message.senderId === currentUser.userId);
    
    if (!canSelect) {
      console.log("Cannot select: not admin and not own message");
      return;
    }
    
    if (selectedMessages.length === 0) {
      setSelectedMessages([message]);
    } else if (!isMessageSelected(message.id)) {
      setSelectedMessages(prev => [...prev, message]);
    }
  }, [isGroupAdmin, canSendMessage, currentUser, selectedMessages, isMessageSelected]);

  const handleMessagePress = useCallback((message: Message) => {
    // Only handle selection if messages are already selected
    if (selectedMessages.length === 0) return;
    
    // Permission check:
    // - Admin can select any message
    // - Can send message users can only select their own messages
    // - Cannot send message users cannot select any message
    if (!canSendMessage && !isGroupAdmin) {
      return;
    }
    
    const canSelect = isGroupAdmin || (canSendMessage && currentUser && message.senderId === currentUser.userId);
    
    if (!canSelect) return;
    
    if (isMessageSelected(message.id)) {
      setSelectedMessages(prev => prev.filter(msg => msg.id !== message.id));
    } else {
      setSelectedMessages(prev => [...prev, message]);
    }
  }, [isGroupAdmin, canSendMessage, currentUser, selectedMessages, isMessageSelected]);

  const clearSelection = () => {
    setSelectedMessages([]);
  };

  const handleStartReply = (message: Message) => {
    // Check permissions: Admin can reply to any message, canSendMessage users can reply to any message, cannot send message users cannot reply
    if (!canSendMessage && !isGroupAdmin) {
      // User cannot send messages, so they cannot reply
      return;
    }
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
      // Check permissions before allowing reply via swipe
      // Admin can reply to any message, canSendMessage users can reply to any message, cannot send message users cannot reply
      if (canSendMessage || isGroupAdmin) {
        handleStartReply(message);
      }
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

  // Mark all messages in this room as read for current user
  const markAllMessagesAsReadInRoom = useCallback(async () => {
    try {
      if (!roomId) return;
      const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId;
      const token = await AuthStorage.getToken();
      await axios.post(
        `${API_URL}/api/chat/rooms/${roomIdStr}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.log("Error marking all messages as read for room:", error);
    }
  }, [roomId]);

  // Send recorded audio via same media API (move-to-chat-camera)
  const handleSendAudio = useCallback(async (audioUri: string) => {
    const roomIdStr = typeof roomId === 'string' ? roomId : (Array.isArray(roomId) ? roomId[0] : String(roomId));
    if (!roomIdStr || !currentUser || sending) return;
    setSending(true);
    try {
      const token = await AuthStorage.getToken();
      const filename = `audio_${Date.now()}.m4a`;
      const formData = new FormData();
      // @ts-ignore – FormData append with object for React Native
      formData.append("file", {
        uri: Platform.OS === "ios" ? audioUri.replace("file://", "") : audioUri,
        name: filename,
        type: "audio/m4a",
      });
      formData.append("roomId", roomIdStr);
      formData.append("senderId", currentUser.userId);

      const response = await axios.post(
        `${API_URL}/api/vm-media/move-to-chat-camera`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          transformRequest: (data: any) => data,
          timeout: 60000,
        }
      );

      if (response.data.success) {
        const { messageId, mediaId, createdAt } = response.data;
        const newMessage: Message = {
          id: messageId,
          roomId: parseInt(roomIdStr, 10),
          senderId: currentUser.userId,
          senderName: currentUser.fullName || "You",
          messageText: "",
          messageType: "media",
          createdAt: createdAt || new Date().toISOString(),
          mediaFilesId: mediaId,
          pollId: 0,
          tableId: 0,
        };
        addMessage(newMessage, true);
        socketSendMessage(roomIdStr, {
          id: messageId,
          messageText: "",
          createdAt: newMessage.createdAt,
          messageType: "media",
          mediaFilesId: mediaId,
          pollId: 0,
          tableId: 0,
          replyMessageId: 0,
        });
        markAllMessagesAsReadInRoom();
        setTimeout(() => scrollToBottomRef.current(), 200);
      } else {
        throw new Error(response.data?.error || "Upload failed");
      }
    } catch (error: any) {
      console.error("Send audio error:", error);
      Alert.alert("Send failed", error?.response?.data?.error || error?.message || "Could not send audio.");
    } finally {
      setSending(false);
    }
  }, [roomId, currentUser, sending, addMessage, socketSendMessage, markAllMessagesAsReadInRoom]);

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
      // console.error('Error marking message as read:', error);
      console.log('Error marking message as read:', error);
    }
  }, []);

  const handleVideoCallPress = useCallback(() => {
    if (!roomId) {
      Alert.alert('Error', 'Room ID is missing');
      return;
    }
    
    const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId;
    const roomNameStr = room?.roomName || 'Video Call';
    
    initiateCall(roomIdStr, roomNameStr);
  }, [roomId, room?.roomName, initiateCall]);

  const handleForwardMessages = async (selectedRooms: ChatRoom[], messagesToForward: Message[]) => {
    for (const room of selectedRooms) {
      if (!room.roomId) continue;
      for (const message of messagesToForward) {
        try {
          const token = await AuthStorage.getToken();
          const isPoll = message.messageType === "poll";
          const isMedia = message.messageType === "media";
          const payload: Record<string, unknown> = {
            messageText: message.messageText || "",
            messageType: message.messageType,
            tableId: message.tableId,
            isForward: true
          };
          if (isPoll && message.pollId != null) {
            payload.forwardSourcePollId = message.pollId;
            payload.pollId = null;
          } else if (!isPoll) {
            payload.pollId = message.pollId ?? null;
          }
          if (isMedia && message.mediaFilesId != null) {
            payload.forwardSourceMediaId = message.mediaFilesId;
            payload.mediaFilesId = null;
          } else if (!isMedia) {
            payload.mediaFilesId = message.mediaFilesId ?? null;
          }

          const response = await axios.post(
            `${API_URL}/api/chat/rooms/${room.roomId}/messages`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (currentUser && response.data) {
            const data = response.data;
            socketSendMessage(room.roomId.toString(), {
              id: data.id,
              messageText: data.messageText ?? message.messageText ?? "",
              createdAt: data.createdAt,
              messageType: data.messageType ?? message.messageType,
              mediaFilesId: data.mediaFilesId ?? null,
              pollId: data.pollId ?? null,
              tableId: data.tableId ?? null
            });
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error forwarding to room ${room.roomName}:`, error);
        }
      }
    }
    // Mark each forwarded message as read for the current user (including own messages after forward)
    // so unread count on main page updates correctly
    for (const msg of messagesToForward) {
      if (typeof msg.id === "number") {
        await markMessageAsRead(msg.id);
      }
    }
    clearSelection();
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
    const isHighlighted = highlightedMessageId === message.id;

    // Determine if this message should have a "tail" (pointy corner)
    let hasTail = false;
    if (index === preparedListData.length - 1) {
        hasTail = true;
    } else {
        const chronologicallyPreviousItem = preparedListData[index + 1];
        if (chronologicallyPreviousItem.itemType === 'message') {
            if ((chronologicallyPreviousItem as Message).senderId !== message.senderId) {
                hasTail = true;
            }
        } else if (chronologicallyPreviousItem.itemType === 'dateSeparator') {
            hasTail = true;
        }
    }

    // Only show sender name inside the bubble for INCOMING messages that start a new block
    let showSenderName = false;
    if (!isOwnMessage && hasTail) {
      showSenderName = true;
    }
  // Handle media grid press
  const handleMediaGridPress = (mediaFiles: any[], selectedIndex: number) => {
    console.log("Opening media viewer for media files:", mediaFiles, "at index:", selectedIndex);
    setSelectedMediaFiles(mediaFiles);
    setSelectedMediaIndex(selectedIndex);
    setShowMediaViewer(true);
  };
  
    return (
      <MessageItem
        message={message}
        isOwnMessage={isOwnMessage}
        isSelected={isSelected}
        isGroupAdmin={isGroupAdmin}
        canSendMessage={canSendMessage}
        currentUser={currentUser}
        totalMembers={roomMembers.length}
        selectedMessagesCount={selectedMessages.length}
        messageAnimation={messageAnimation}
        isHighlighted={isHighlighted}
        showSenderName={showSenderName}
        hasTail={hasTail}
        onSelect={handleSelectMessage}
        onDeselect={handleDeselectMessage}
        onStartSelection={handleStartSelection}
        onGestureBegin={handleGestureBegin}
        onGestureUpdate={handleGestureUpdate}
        onGestureEnd={handleGestureEnd}
        onReplyPreviewClick={handleReplyPreviewClick}
        formatTime={formatISTTime}
        handleMediaGridPress={handleMediaGridPress}
      />
    );
  }, [
    preparedListData,
    currentUser, 
    selectedMessages.length, 
    formatDateForDisplay, 
    isGroupAdmin,
    canSendMessage, 
    isMessageSelected,
    handleSelectMessage,
    handleDeselectMessage,
    handleStartSelection,
    handleGestureBegin,
    handleGestureUpdate,
    handleGestureEnd,
    handleReplyPreviewClick,
    getMessageAnimation,
    highlightedMessageId,
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
  onVideoCallPress,
  isSyncing,
}: {
  roomName: string;
  memberCount: number;
  onlineCount: number;
  onBackPress: () => void;
  onAvatarPress: () => void;
  onMenuPress?: () => void;
  onVideoCallPress?: () => void;
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
    <View className="flex-row items-center px-2 py-2.5 bg-white border-b border-[#E5E5E5]">
      <TouchableOpacity onPress={onBackPress} className="p-2">
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      <TouchableOpacity onPress={onMenuPress} className="flex-1 flex-row items-center ml-1">
        <View className="w-10 h-10 rounded-full bg-[#0088CC] justify-center items-center">
          <Text className="text-base font-semibold text-white">{getInitials(roomName)}</Text>
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-[17px] font-semibold text-black" numberOfLines={1}>
            {roomName}
          </Text>
          <View className="flex-row items-center mt-0.5">
            {isSyncing ? (
              <Text className="text-[13px] text-[#8E8E93]">updating...</Text>
            ) : (
              <Text className="text-[13px] text-[#8E8E93]">{getStatusText()}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* <View className="flex-row items-center">
        {onAvatarPress && (
          <TouchableOpacity onPress={onAvatarPress} className="p-2">
            <Ionicons name="ellipsis-vertical" size={20} color="#000" />
          </TouchableOpacity>
        )}
      </View> */}
    </View>
  );
});

  // ==================== MAIN RENDER ====================
  const insets = useSafeAreaInsets();
  
  return (
    <GestureHandlerRootView className="flex-1">
      {/* NO SafeAreaView - we handle insets manually */}
      <View 
        style={{ 
          flex: 1, 
          backgroundColor: 'white',
          paddingTop: insets.top, // Only top safe area
        }}
      >
      {/* --- HEADER SECTION --- */}
      {selectedMessages.length > 0 ? (
        <ChatMessageOptions
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
          isAdmin={isGroupAdmin}
          canSendMessage={canSendMessage}
          onClose={clearSelection}
          onForward={handleForwardMessages}
          currentRoomId={Array.isArray(roomId) ? String(roomId[0]) : String(roomId)}
          onDeletePress={handleDeleteMessages}
          roomId={Array.isArray(roomId) ? roomId[0] : roomId}
          roomMembers={roomMembers}
          currentUser={currentUser}
          onMessageEdited={onMessageEditedFromOptions}
        />
      ) : (
        <TelegramHeader
          roomName={displayRoomName}
          memberCount={roomMembers.length}
          onlineCount={onlineUsers.length}
          onBackPress={() => {
            if (router.canGoBack()) {
              router.back();              // normal flow
            } else {
              router.replace("/(drawer)"); // notification / cold start
            }
          }}
          onAvatarPress={() => setShowMembersModal(true)}
          onMenuPress={isGroupAdmin ? () => router.push({
            pathname: "/chat/room-info",
            params: { roomId },
          }) : undefined}
          onVideoCallPress={handleVideoCallPress}
          isSyncing={isSyncing}
        />
      )}

      {/* --- MESSAGES LIST --- */}
      <View className="flex-1 bg-[#E5DDD5]" style={{ position: 'relative' }}>
        <FlatList
          ref={flatListRef}
          data={preparedListData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          inverted={true}
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 6 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center pb-[300px]">
              <Ionicons name="chatbubble-outline" size={60} color="#AEBAC1" />
              <Text className="text-gray-500 mt-4 text-center bg-[#E5DDD5] px-2 py-1">
                No messages yet.
              </Text>
            </View>
          }
        />
        
        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
  <TouchableOpacity
    onPress={scrollToBottom}
    style={{
      position: 'absolute',
      bottom: 10,
      right: 10,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#0088CC',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      zIndex: 1000,
    }}
    activeOpacity={0.7}
  >
    {/* Custom Double Arrow Down SVG */}
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 6 L12 11 L17 6 M7 13 L12 18 L17 13"
          stroke="#FFFFFF"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  )}
      </View>

      {/* --- MESSAGE INPUT SECTION --- */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        style={{ flex: 0 }}
      >
        <View style={{ backgroundColor: '#E5DDD5', paddingBottom: insets.bottom }}>
          <View className="pb-1">
          {canSendMessage ? (
            <MessageInput
              messageText={messageText}
              onChangeText={setMessageText}
              onSend={(text, messageType, mediafilesId, tableId, pollId, scheduledAt) => {
                sendMessage(
                  text, 
                  messageType, 
                  mediafilesId, 
                  tableId, 
                  pollId, 
                  replyToMessage?.id as number, 
                  scheduledAt
                );
                handleCancelReply();
              }}
              placeholder="Message"
              sending={sending}
              currentUser={currentUser}
              replyToMessage={replyToMessage}
              onCancelReply={handleCancelReply}
              onAttachmentPress={() => {
                router.push({
                  pathname: "/chat/[roomId]/attachments",
                  params: { roomId: roomId as string, userId: currentUser?.userId ?? "" },
                });
              }}
              isAttachmentSheetOpen={false}
              onFocus={handleMainInputFocus}
              onBlur={handleMainInputBlur}
              onSendAudio={handleSendAudio}
            />
          ) : (
            <View className="p-3 bg-white/95 m-2 rounded-lg items-center border border-gray-200">
              <Text className="text-[#54656F] text-sm text-center">
                Only group admins can send messages
              </Text>
            </View>
          )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* --- MODALS --- */}
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

      {/* Scheduled Messages Modal */}
      <Modal
        visible={showScheduledMessages}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowScheduledMessages(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'white', paddingTop: insets.top }}>
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
        </View>
      </Modal>

      <AudioRecorder
        isVisible={showAudioRecorder}
        onRecordingComplete={() => {}}
        onCancel={() => {
          setShowAudioRecorder(false);
          setIsRecordingAudio(false);
        }}
      />
    </View>
  </GestureHandlerRootView>
);
}