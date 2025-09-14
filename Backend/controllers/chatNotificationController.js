// Backend/controllers/chatNotificationController.js
import pool from "../config/database.js";
import { admin, isFirebaseInitialized } from "../config/firebase.js";

// Format message content for notification based on message type
const formatMessageContent = (message, senderName) => {
  const messageType = message.messageType || 'text';
  
  switch (messageType) {
    case 'text':
      // Show first 50 characters of text message
      return message.messageText ? message.messageText.substring(0, 50) + (message.messageText.length > 50 ? '...' : '') : 'sent a message';
    
    case 'media':
      return 'shared media';
    
    case 'poll':
      return 'shared a poll';
    
    case 'table':
      return 'shared a table';
    
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
const getUserAppState = (userId, io, socketToUser, userToSockets) => {
  const userSockets = userToSockets.get(userId) || new Set();
  
  if (userSockets.size === 0) {
    return { isOnline: false, isOnChatTab: false, currentRoomId: null };
  }

  let isOnChatTab = false;
  let currentRoomId = null;

  // Check all user's sockets to determine their state
  for (const socketId of userSockets) {
    const userInfo = socketToUser.get(socketId);
    if (userInfo) {
      // Check if user is in any chat room (means they're on chat tab)
      if (userInfo.currentRooms && userInfo.currentRooms.length > 0) {
        isOnChatTab = true;
        // Get the first/current room they're in
        currentRoomId = userInfo.currentRooms[0];
        break;
      }
    }
  }

  return {
    isOnline: true,
    isOnChatTab,
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
        ...data,
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
            ...data,
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
      }
    } catch (sendError) {
      console.log('sendEachForMulticast/sendEach failed, trying individual sends:', sendError.message);
      
      // Fallback to individual sends
      let successCount = 0;
      let failureCount = 0;
      const failedTokens = [];

      for (const message of messages) {
        try {
          await admin.messaging().send(message);
          successCount++;
          console.log(`✅ FCM notification sent to token: ${message.token.substring(0, 20)}...`);
        } catch (tokenError) {
          failureCount++;
          failedTokens.push({ token: message.token.substring(0, 20) + '...', error: tokenError.message });
          console.error(`❌ Failed to send to token ${message.token.substring(0, 20)}...:`, tokenError.message);
        }
      }
      
      response = {
        successCount,
        failureCount,
        responses: failedTokens.map(ft => ({ success: false, error: ft.error }))
      };
    }
    
    if (response.failureCount > 0) {
      console.log('Failed FCM tokens:', response.responses
        .map((resp, idx) => resp.success ? null : { token: tokens[idx]?.substring(0, 20) + '...', error: resp.error?.message || 'Unknown error' })
        .filter(Boolean)
      );
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
export const sendChatNotifications = async (message, senderInfo, roomInfo, io, socketToUser, userToSockets) => {
  try {
    console.log('📱 Processing chat notifications for room:', roomInfo.roomId);
    
    // Get all room members except sender
    const membersResult = await pool.query(
      `SELECT u."userId", u."fullName" FROM chatroomusers cru
       JOIN "users" u ON cru."userId" = u."userId"
       WHERE cru."roomId" = $1 AND u."userId" != $2`,
      [roomInfo.roomId, senderInfo.userId]
    );

    const members = membersResult.rows;
    
    if (members.length === 0) {
      console.log('No members to notify in room:', roomInfo.roomId);
      return;
    }

    // Group users by their notification needs
    const usersToNotify = [];
    const notificationData = {};

    for (const member of members) {
      const userId = member.userId;
      const userState = getUserAppState(userId, io, socketToUser, userToSockets);
      
      console.log(`User ${userId} state:`, userState);
      
      let shouldNotify = false;
      
      if (!userState.isOnline) {
        // Case 1: User is not on application
        shouldNotify = true;
      } else if (userState.isOnline) {
        if (!userState.isOnChatTab) {
          // Case 2.2: User is online but not on chat tab
          shouldNotify = true;
        } else if (userState.isOnChatTab) {
          // Case 2.1: User is on chat tab
          if (userState.currentRoomId !== roomInfo.roomId.toString()) {
            // Case 2.1.2: User is in different chat room
            shouldNotify = true;
          }
          // Case 2.1.1: User is on main chat screen or same room - no notification
        }
      }

      if (shouldNotify) {
        usersToNotify.push(userId);
        
        // Check if this is a reply to user's message
        const isReply = await isReplyToUser(message, userId);
        
        notificationData[userId] = {
          fullName: member.fullName,
          isReply,
          isOnline: userState.isOnline
        };
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
      if (!userData) return;

      // Create personalized notification content
      let title, body;
      
      if (userData.isReply) {
        title = `${senderInfo.userName} replied to you`;
        body = `in ${roomInfo.roomName}`;
      } else {
        title = roomInfo.roomName;
        body = `${senderInfo.userName}: ${formatMessageContent(message, senderInfo.userName)}`;
      }

      // Notification data for app handling
      const notificationDataPayload = {
        type: 'chat_message',
        roomId: roomInfo.roomId.toString(),
        roomName: roomInfo.roomName,
        messageId: message.id.toString(),
        senderId: senderInfo.userId,
        senderName: senderInfo.userName,
        messageType: message.messageType || 'text',
        isReply: userData.isReply.toString(),
        timestamp: message.createdAt || new Date().toISOString()
      };

      return sendFCMNotification(tokens, title, body, notificationDataPayload);
    });

    // Execute all notifications
    const results = await Promise.allSettled(notificationPromises);
    
    let totalSuccess = 0;
    let totalFailure = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        totalSuccess += result.value.successCount || 0;
        totalFailure += result.value.failureCount || 0;
      } else {
        console.error(`Notification failed for user:`, result.reason);
        totalFailure++;
      }
    });

    console.log(`📊 Chat notification summary: ${totalSuccess} sent, ${totalFailure} failed`);

  } catch (error) {
    console.error('Error in sendChatNotifications:', error);
  }
};

// Create notification channels (for Android)
export const createChatNotificationChannel = () => {
  return {
    channelId: 'chat_channel',
    channelName: 'Chat Messages',
    channelDescription: 'Notifications for chat messages',
    importance: 'high',
    sound: 'default',
    vibration: true,
    showBadge: true
  };
};

export default {
  sendChatNotifications,
  createChatNotificationChannel
};
