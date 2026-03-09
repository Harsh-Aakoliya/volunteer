// Backend/controllers/chatNotificationController.js
import pool from "../config/database.js";
import { admin, isFirebaseInitialized } from "../config/firebase.js";

// Strip HTML tags from text
const stripHtmlTags = (html) => {
  if (!html) return "";
  let text = String(html);
  
  // Replace block elements with newlines
  text = text.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');
  
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // Clean up multiple spaces and newlines
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  text = text.replace(/^\s+|\s+$/g, '');
  
  return text;
};

// Format message content for notification based on message type
const formatMessageContent = async (message, senderName) => {
  const messageType = message.messageType || 'text';

  const pluralize = (n, singular, plural) => (n === 1 ? singular : plural);

  const getMediaSummary = async (mediaFilesId) => {
    if (!mediaFilesId) return null;
    try {
      const mediaResult = await pool.query(
        'SELECT "driveUrlObject" FROM media WHERE "id" = $1',
        [mediaFilesId]
      );
      if (mediaResult.rows.length === 0) return null;
      let driveUrlObject = mediaResult.rows[0].driveUrlObject || [];
      if (typeof driveUrlObject === "string") {
        try { driveUrlObject = JSON.parse(driveUrlObject); } catch { driveUrlObject = []; }
      }
      if (!Array.isArray(driveUrlObject)) driveUrlObject = [];
      let photos = 0;
      let videos = 0;
      let audios = 0;
      for (const item of driveUrlObject) {
        const mime = String(item?.mimeType || "").toLowerCase();
        if (mime.startsWith("image/")) photos++;
        else if (mime.startsWith("video/")) videos++;
        else if (mime.startsWith("audio/")) audios++;
      }
      return { photos, videos, audios };
    } catch (error) {
      console.error('Error fetching media summary:', error);
      return null;
    }
  };

  const formatMediaNotificationText = ({ photos, videos, audios }) => {
    // Single audio
    if (audios > 0 && photos === 0 && videos === 0) {
      return audios === 1 ? 'sent a voice message' : `sent ${audios} voice messages`;
    }
    const totalVisual = photos + videos;
    // Single photo/video
    if (totalVisual === 1) {
      if (photos === 1) return 'sent 1 photo';
      if (videos === 1) return 'sent 1 video';
    }
    // Multiple
    const parts = [];
    if (photos > 0) parts.push(`${photos} ${pluralize(photos, 'photo', 'photos')}`);
    if (videos > 0) parts.push(`${videos} ${pluralize(videos, 'video', 'videos')}`);
    if (audios > 0) parts.push(audios === 1 ? 'voice message' : `${audios} voice messages`);
    return parts.length ? `shared ${parts.join(', ')}` : 'shared media';
  };

  const getPollTitle = async (pollId) => {
    if (!pollId) return null;
    try {
      const res = await pool.query('SELECT "question" FROM poll WHERE "id" = $1', [pollId]);
      if (res.rows.length === 0) return null;
      return res.rows[0].question ? String(res.rows[0].question) : null;
    } catch (error) {
      console.error('Error fetching poll title:', error);
      return null;
    }
  };
  
  switch (messageType) {
    case 'text':
      // Show first 50 characters of text message, strip HTML first
      if (message.messageText) {
        const cleaned = stripHtmlTags(message.messageText);
        return cleaned.substring(0, 50) + (cleaned.length > 50 ? '...' : '');
      }
      return 'sent a message';
    
    case 'media': {
      // WhatsApp-style: ignore captions for notification body
      const summary = await getMediaSummary(message.mediaFilesId);
      if (summary) return formatMediaNotificationText(summary);
      return 'shared media';
    }
    
    case 'poll': {
      const title = await getPollTitle(message.pollId);
      if (title) {
        const cleaned = stripHtmlTags(title);
        return `sent a poll (${cleaned.substring(0, 80)}${cleaned.length > 80 ? '...' : ''})`;
      }
      return 'sent a poll';
    }
    
    case 'table':
      return 'shared a table';
    
    case 'announcement':
      // For announcements, extract title from messageText (format: "title|||ANNOUNCEMENT_SEPARATOR|||body")
      if (message.messageText && message.messageText.includes('|||ANNOUNCEMENT_SEPARATOR|||')) {
        const title = message.messageText.split('|||ANNOUNCEMENT_SEPARATOR|||')[0].trim();
        if (title) {
          const cleaned = stripHtmlTags(title);
          return `📢 ${cleaned}`;
        }
      }
      return 'shared an announcement';
    
    default:
      return 'sent a message';
  }
};

// Check if message is a reply to user's message
const isReplyToUser = async (message, userId) => {
  if (!message.replyMessageId) return false;
  
  try {
    const replyResult = await pool.query(
      'SELECT "senderId" FROM chatmessages WHERE "id" = $1',
      [message.replyMessageId]
    );
    
    return replyResult.rows.length > 0 && replyResult.rows[0].senderId === userId;
  } catch (error) {
    console.error('Error checking reply message:', error);
    return false;
  }
};

// Get user's current app state from socket connections
// messageRoomId: the room where the message was sent - used to check if user is viewing that exact room
const getUserAppState = (userId, io, socketToUser, userToSockets, onlineUsersSet, messageRoomId = null) => {
  const userIdStr = String(userId);
  const messageRoomIdStr = messageRoomId ? String(messageRoomId) : null;
  const userSockets = userToSockets.get(userIdStr) || new Set();
  
  // Check if user is online
  const isOnline = onlineUsersSet.has(userIdStr);
  
  if (!isOnline || userSockets.size === 0) {
    return { isOnline: false, isOnChatTab: false, isInThisRoom: false, currentRoomId: null };
  }

  let isOnChatTab = false;
  let isInThisRoom = false;
  let currentRoomId = null;

  // Check all user's sockets to determine their state
  for (const socketId of userSockets) {
    const userInfo = socketToUser.get(socketId);
    if (userInfo?.rooms && userInfo.rooms.size > 0) {
      isOnChatTab = true;
      currentRoomId = Array.from(userInfo.rooms)[0];
      // Only skip notification if user is viewing the SAME room as the message
      if (messageRoomIdStr && userInfo.rooms.has(messageRoomIdStr)) {
        isInThisRoom = true;
      }
      break;
    }
  }

  return {
    isOnline: true,
    isOnChatTab,
    isInThisRoom,
    currentRoomId
  };
};

// Send FCM notification to specific users
const sendFCMNotification = async (tokens, title, body, data = {}) => {
  if (!isFirebaseInitialized()) {
    console.log('Firebase not initialized, skipping FCM notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!tokens || tokens.length === 0) {
    console.log('No FCM tokens provided');
    return { success: false, error: 'No tokens' };
  }

  try {
    // Create messages array for sendEach method
    const messages = tokens.map(token => ({
      token: token,
      notification: {
        title,
        body,
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key, 
            value === null || value === undefined ? '' : String(value)
          ])
        ),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        sound: 'default',
      },
      android: {
        notification: {
          channelId: 'chat_channel',
          sound: 'default',
          priority: 'high',
          defaultSound: true,
        },
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    }));

    // Try sendEachForMulticast first (most efficient for multiple tokens), then sendEach, then individual sends
    let response;
    try {
      // Use sendEachForMulticast if we have multiple tokens
      if (tokens.length > 1) {
        const multicastMessage = {
          tokens: tokens,
          notification: {
            title,
            body,
          },
          data: {
            ...Object.fromEntries(
              Object.entries(data).map(([key, value]) => [
                key, 
                value === null || value === undefined ? '' : String(value)
              ])
            ),
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            sound: 'default',
          },
          android: {
            notification: {
              channelId: 'chat_channel',
              sound: 'default',
              priority: 'high',
              defaultSound: true,
            },
            priority: 'high',
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        };
        response = await admin.messaging().sendEachForMulticast(multicastMessage);
        console.log(`✅ FCM sendEachForMulticast completed: ${response.successCount}/${tokens.length} sent`);
      } else {
        response = await admin.messaging().sendEach(messages);
        console.log(`✅ FCM sendEach completed: ${response.successCount}/${tokens.length} sent`);
        
        // Handle failed tokens from sendEach response
        if (response.failureCount > 0 && response.responses) {
          const invalidTokens = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              // Handle different error formats
              const error = resp.error || {};
              const errorCode = error.code || '';
              const errorMessage = String(error.message || error || '');
              
              console.log(`Token ${idx} error:`, { code: errorCode, message: errorMessage });
              
              // Check if token is invalid and should be removed
              if (errorCode === 'messaging/invalid-registration-token' ||
                  errorCode === 'messaging/registration-token-not-registered' ||
                  errorMessage.includes('SenderId mismatch') ||
                  errorMessage.includes('Invalid registration token') ||
                  errorMessage.includes('registration-token-not-registered')) {
                invalidTokens.push(tokens[idx]);
                console.log(`  → Marking token ${idx} as invalid (will be deactivated)`);
              }
            }
          });
          
          // Remove invalid tokens from database
          if (invalidTokens.length > 0) {
            try {
              const pool = await import("../config/database.js").then((m) => m.default);
              const result = await pool.query(
                'UPDATE "notification_tokens" SET "isActive" = FALSE WHERE "token" = ANY($1) RETURNING "userId"',
                [invalidTokens]
              );
              console.log(`🗑️  Deactivated ${result.rowCount} invalid FCM tokens from database (SenderId mismatch)`);
              console.log(`   Affected users: ${result.rows.map(r => r.userId).join(', ')}`);
              console.log(`   ⚠️  These users need to re-register their FCM tokens with the new Firebase project`);
            } catch (dbError) {
              console.error('Error removing invalid tokens:', dbError);
            }
          }
        }
      }
    } catch (sendError) {
      console.log('sendEachForMulticast/sendEach failed, trying individual sends:', sendError.message);
      
      // Fallback to individual sends
      let successCount = 0;
      let failureCount = 0;
      const failedTokens = [];
      const invalidTokens = []; // Tokens that should be removed from database

      for (const message of messages) {
        try {
          await admin.messaging().send(message);
          successCount++;
          console.log(`✅ FCM notification sent to token: ${message.token.substring(0, 20)}...`);
        } catch (tokenError) {
          failureCount++;
          const errorMessage = tokenError.message || tokenError.error?.message || 'Unknown error';
          failedTokens.push({ token: message.token.substring(0, 20) + '...', error: errorMessage });
          console.error(`❌ Failed to send to token ${message.token.substring(0, 20)}...:`, errorMessage);
          
          // Check if token is invalid and should be removed
          if (errorMessage.includes('SenderId mismatch') || 
              errorMessage.includes('Invalid registration token') ||
              errorMessage.includes('Requested entity was not found') ||
              errorMessage.includes('registration-token-not-registered')) {
            invalidTokens.push(message.token);
          }
        }
      }
      
      // Remove invalid tokens from database
      if (invalidTokens.length > 0) {
        try {
          const pool = await import("../config/database.js").then((m) => m.default);
          await pool.query(
            'UPDATE "notification_tokens" SET "isActive" = FALSE WHERE "token" = ANY($1)',
            [invalidTokens]
          );
          console.log(`🗑️  Deactivated ${invalidTokens.length} invalid FCM tokens from database`);
        } catch (dbError) {
          console.error('Error removing invalid tokens:', dbError);
        }
      }
      
      response = {
        successCount,
        failureCount,
        responses: failedTokens.map(ft => ({ success: false, error: ft.error }))
      };
    }
    
    if (response.failureCount > 0) {
      const failedTokens = response.responses
        .map((resp, idx) => resp.success ? null : { token: tokens[idx]?.substring(0, 20) + '...', error: resp.error?.message || resp.error || 'Unknown error' })
        .filter(Boolean);
      
      console.log('Failed FCM tokens:', failedTokens);
      
      // Check for SenderId mismatch or invalid tokens
      const invalidTokenErrors = failedTokens.filter(ft => 
        ft.error.includes('SenderId mismatch') || 
        ft.error.includes('Invalid registration token') ||
        ft.error.includes('registration-token-not-registered')
      );
      
      if (invalidTokenErrors.length > 0) {
        console.log('⚠️  Some tokens have SenderId mismatch - they were registered with a different Firebase project.');
        console.log('   Users need to re-register their FCM tokens with the current Firebase project.');
        console.log('   Old project: react-expo-push-notifica-eadbd');
        console.log('   New project: management-1018d');
      }
    }

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    return { success: false, error: error.message };
  }
};

// Main function to send chat notifications
export const sendChatNotifications = async (message, senderInfo, roomInfo, io, socketToUser, userToSockets, onlineUsersSet) => {
  try {
    console.log('📱 Processing chat notifications for room:', roomInfo.roomId);
    
    // Get all room members except sender (include canSendMessage for notification payload)
    const membersResult = await pool.query(
      `SELECT sm."seid"::text as "userId", sm."sevakname" as "fullName", cru."canSendMessage"
       FROM chatroomusers cru
       JOIN "SevakMaster" sm ON cru."userId" = sm."seid"
       WHERE cru."roomId" = $1 AND sm."seid"::text != $2`,
      [roomInfo.roomId, senderInfo.userId]
    );

    const members = membersResult.rows;
    console.log("members in sendChatNotifications",members);
    
    if (members.length === 0) {
      console.log('No members to notify in room:', roomInfo.roomId);
      return;
    }

    // Group users by their notification needs
    // Skip notification ONLY when user is in the SAME room as the message
    const usersToNotify = [];
    const notificationData = {};

    for (const member of members) {
      const userId = member.userId;
      const userState = getUserAppState(userId, io, socketToUser, userToSockets, onlineUsersSet, roomInfo.roomId);
      
      console.log(`User ${userId} state:`, userState);
      
      // Only skip notification if user is actively viewing this exact room
      const shouldNotify = !(userState.isOnline && userState.isInThisRoom);
      
      if (shouldNotify) {
        console.log(`  → User ${userId} will receive notification (online: ${userState.isOnline}, isInThisRoom: ${userState.isInThisRoom})`);
        usersToNotify.push(userId);
        
        // Check if this is a reply to user's message
        const isReply = await isReplyToUser(message, userId);
        
        const memberCanSend = member.canSendMessage === true || member.canSendMessage === 1;
        
        notificationData[userId] = {
          fullName: member.fullName,
          isReply,
          isOnline: userState.isOnline,
          canSendMessage: memberCanSend
        };
      } else {
        console.log(`  → User ${userId} is viewing this room, skipping notification`);
      }
    }

    if (usersToNotify.length === 0) {
      console.log('No users need notifications for room:', roomInfo.roomId);
      return;
    }

    console.log(`📬 Sending notifications to ${usersToNotify.length} users:`, usersToNotify);

    // Get FCM tokens for users who need notifications
    const tokensResult = await pool.query(
      `SELECT "userId", "token" FROM notification_tokens 
       WHERE "userId" = ANY($1) AND "isActive" = TRUE AND "tokenType" = 'fcm'`,
      [usersToNotify]
    );

    if (tokensResult.rows.length === 0) {
      console.log('No active FCM tokens found for users');
      return;
    }

    // Group tokens by user for personalized notifications
    const userTokens = {};
    tokensResult.rows.forEach(row => {
      if (!userTokens[row.userId]) {
        userTokens[row.userId] = [];
      }
      userTokens[row.userId].push(row.token);
    });

    // Send personalized notifications to each user
    const notificationPromises = Object.entries(userTokens).map(async ([userId, tokens]) => {
      const userData = notificationData[userId];
      if (!userData) {
        console.log(`⚠️ No user data for userId: ${userId}`);
        return { success: false, error: 'No user data' };
      }

      // Create personalized notification content
      let title, body;
      
      if (userData.isReply) {
        title = `${senderInfo.userName || 'Someone'} replied to you`;
        body = `in ${roomInfo.roomName || 'Chat'}`;
      } else {
        title = String(roomInfo.roomName || 'Chat');
        const messageContent = await formatMessageContent(message, senderInfo.userName || 'Someone');
        body = `${senderInfo.userName || 'Someone'}: ${messageContent}`;
      }

      // Notification data for app handling + message payload for local storage
      // IMPORTANT: All values must be strings for FCM (no null/undefined). Total payload ~4KB max.
      const safeString = (val) => {
        if (val === null || val === undefined) return '';
        return String(val);
      };
      // Truncate messageText for FCM (strip HTML first); max ~1500 chars to stay under 4KB
      let messageTextForPayload = '';
      if (message.messageText) {
        messageTextForPayload = stripHtmlTags(message.messageText);
        if (messageTextForPayload.length > 1500) {
          messageTextForPayload = messageTextForPayload.substring(0, 1500);
        }
      }

      const notificationDataPayload = {
        type: 'chat_message',
        roomId: safeString(roomInfo.roomId),
        roomName: safeString(roomInfo.roomName),
        messageId: safeString(message.id),
        senderId: safeString(senderInfo.userId),
        senderName: safeString(senderInfo.userName),
        messageType: safeString(message.messageType || 'text'),
        isReply: safeString(Boolean(userData.isReply)),
        canSendMessage: safeString(Boolean(userData.canSendMessage)),
        timestamp: safeString(message.createdAt || new Date().toISOString()),
        // Message payload for local storage so tap can show message immediately
        messageText: messageTextForPayload,
        replyMessageId: safeString(message.replyMessageId),
        replyMessageText: message.replyMessageText ? safeString(stripHtmlTags(String(message.replyMessageText)).substring(0, 200)) : '',
        replySenderName: safeString(message.replySenderName),
        replyMessageType: safeString(message.replyMessageType),
        mediaFilesId: safeString(message.mediaFilesId),
        pollId: safeString(message.pollId),
        tableId: safeString(message.tableId),
      };

      console.log(`📤 Sending notification to user ${userId} with payload:`, notificationDataPayload);
      
      try {
        return await sendFCMNotification(tokens, title, body, notificationDataPayload);
      } catch (error) {
        console.error(`❌ Error sending notification to user ${userId}:`, error);
        return { success: false, error: error.message };
      }
    });

    // Execute all notifications
    const results = await Promise.allSettled(notificationPromises);
    
    let totalSuccess = 0;
    let totalFailure = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value && result.value.success) {
          totalSuccess += result.value.successCount || 1;
          totalFailure += result.value.failureCount || 0;
        } else {
          console.error(`❌ Notification failed for user at index ${index}:`, result.value?.error || 'Unknown error');
          totalFailure += result.value?.failureCount || 1;
        }
      } else {
        console.error(`❌ Notification promise rejected for user at index ${index}:`, result.reason);
        totalFailure++;
      }
    });

    console.log(`📊 Chat notification summary: ${totalSuccess} sent, ${totalFailure} failed`);

  } catch (error) {
    console.error('Error in sendChatNotifications:', error);
  }
};