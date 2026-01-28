// Backend/socket.js
// Clean Socket.IO server implementation with improved video call support

import { sendChatNotifications } from "./controllers/chatNotificationController.js";

const setupSocketIO = (io, app) => {
  // Make io globally available
  global.io = io;

  // ==================== DATA STORES ====================

  // Map: socketId -> { userId, userName, rooms: Set<roomId> }
  const socketUsers = new Map();

  // Map: userId -> Set<socketId>
  const userSockets = new Map();

  // Set: online user IDs
  const onlineUsers = new Set();

  // Map: roomId -> last message data
  const lastMessages = app.get('lastMessageByRoom');

  // Map: userId -> { roomId: unreadCount }
  const unreadCounts = app.get('unreadMessagesByUser');

  // Throttle: userId -> lastRequestTime
  const requestThrottle = new Map();

  // ==================== VIDEO CALL DATA STORES ====================
  
  // Map: roomId -> Set<userId> (active call participants)
  const activeCallParticipants = new Map();

  // Make globally accessible
  global.lastMessageByRoom = lastMessages;
  global.unreadMessagesByUser = unreadCounts;

  // ==================== INITIALIZATION ====================

  const initializeData = async () => {
    try {
      console.log("🔄 [Socket] Initializing room data...");
      const pool = await import("./config/database.js").then((m) => m.default);

      const roomsResult = await pool.query('SELECT "roomId" FROM chatrooms');

      for (const { roomId } of roomsResult.rows) {
        const roomIdStr = roomId.toString();

        const msgResult = await pool.query(
          `SELECT m.*, sm."sevakname" as "senderName"
           FROM chatmessages m 
           JOIN "SevakMaster" sm ON m."senderId"::integer = sm."seid"
           WHERE m."roomId" = $1 
           ORDER BY m."createdAt" DESC 
           LIMIT 1`,
          [roomId]
        );

        if (msgResult.rows.length > 0) {
          const msg = msgResult.rows[0];
          lastMessages[roomIdStr] = {
            id: msg.id,
            messageText: msg.messageText,
            messageType: msg.messageType || "text",
            createdAt: msg.createdAt,
            roomId: roomIdStr,
            sender: {
              userId: msg.senderId,
              userName: msg.senderName || "Unknown",
            },
            mediaFilesId: msg.mediaFilesId || null,
            pollId: msg.pollId || null,
            tableId: msg.tableId || null,
          };
        }

        const membersResult = await pool.query(
          'SELECT "userId" FROM chatroomusers WHERE "roomId" = $1',
          [roomId]
        );

        for (const { userId } of membersResult.rows) {
          const userIdStr = userId.toString();
          if (!unreadCounts[userIdStr]) {
            unreadCounts[userIdStr] = {};
          }
          if (unreadCounts[userIdStr][roomIdStr] === undefined) {
            unreadCounts[userIdStr][roomIdStr] = 0;
          }
        }
      }

      console.log("✅ [Socket] Data initialized");
    } catch (error) {
      console.error("❌ [Socket] Init error:", error);
    }
  };

  initializeData();

  // ==================== HELPER FUNCTIONS ====================

  const isThrottled = (userId, ms = 2000) => {
    const now = Date.now();
    const last = requestThrottle.get(userId) || 0;
    if (now - last < ms) return true;
    requestThrottle.set(userId, now);
    return false;
  };

  const getOnlineUsersInRoom = async (roomId) => {
    try {
      const pool = await import("./config/database.js").then((m) => m.default);
      const result = await pool.query(
        'SELECT "userId" FROM chatroomusers WHERE "roomId" = $1',
        [roomId]
      );

      const roomMembers = result.rows.map((r) => r.userId.toString());
      const online = roomMembers.filter((id) => onlineUsers.has(id));

      return {
        onlineUsers: online,
        onlineCount: online.length,
        totalMembers: roomMembers.length,
      };
    } catch {
      return { onlineUsers: [], onlineCount: 0, totalMembers: 0 };
    }
  };

  // Get all online members of a room
  const getOnlineRoomMembers = async (roomId) => {
    try {
      const pool = await import("./config/database.js").then((m) => m.default);
      const result = await pool.query(
        'SELECT "userId" FROM chatroomusers WHERE "roomId" = $1',
        [roomId]
      );

      const roomMembers = result.rows.map((r) => r.userId.toString());
      return roomMembers.filter((id) => onlineUsers.has(id));
    } catch (error) {
      console.error("❌ [Socket] Error getting room members:", error);
      return [];
    }
  };

  // Emit to a specific user (all their sockets)
  const emitToUser = (userId, event, data) => {
    const sockets = userSockets.get(String(userId));
    if (sockets) {
      for (const sid of sockets) {
        const socket = io.sockets.sockets.get(sid);
        if (socket) {
          socket.emit(event, data);
        }
      }
    }
  };

  const sendUnreadCounts = (socket, userId) => {
    const counts = unreadCounts[userId] || {};
    socket.emit("unreadCounts", { unreadCounts: counts });
  };

  const broadcastUserStatus = async (userId, isOnline) => {
    try {
      const pool = await import("./config/database.js").then((m) => m.default);
      const result = await pool.query(
        'SELECT DISTINCT "roomId" FROM chatroomusers WHERE "userId" = $1',
        [userId]
      );

      for (const { roomId } of result.rows) {
        const roomIdStr = roomId.toString();
        io.to(`room_${roomIdStr}`).emit("userOnlineStatusUpdate", {
          userId,
          isOnline,
        });

        const onlineInfo = await getOnlineUsersInRoom(roomId);
        io.to(`room_${roomIdStr}`).emit("onlineUsers", {
          roomId: roomIdStr,
          ...onlineInfo,
        });
      }
    } catch (error) {
      console.error("❌ [Socket] Status broadcast error:", error);
    }
  };

  const notifyRoomMembers = async (roomId, lastMessage, senderId) => {
    try {
      const pool = await import("./config/database.js").then((m) => m.default);
      const result = await pool.query(
        'SELECT "userId" FROM chatroomusers WHERE "roomId" = $1',
        [roomId]
      );

      const roomIdStr = roomId.toString();

      for (const { userId } of result.rows) {
        const userIdStr = userId.toString();
        const sockets = userSockets.get(userIdStr);

        if (sockets && sockets.size > 0) {
          const isInRoom = Array.from(sockets).some((sid) => {
            const userData = socketUsers.get(sid);
            return userData?.rooms?.has(roomIdStr);
          });

          if (!isInRoom && userIdStr !== senderId) {
            if (!unreadCounts[userIdStr]) unreadCounts[userIdStr] = {};
            unreadCounts[userIdStr][roomIdStr] =
              (unreadCounts[userIdStr][roomIdStr] || 0) + 1;
          }

          for (const sid of sockets) {
            const socket = io.sockets.sockets.get(sid);
            if (socket) {
              socket.emit("roomUpdate", {
                roomId: roomIdStr,
                lastMessage,
                unreadCount: unreadCounts[userIdStr]?.[roomIdStr] || 0,
              });
            }
          }
        } else if (userIdStr !== senderId) {
          if (!unreadCounts[userIdStr]) unreadCounts[userIdStr] = {};
          unreadCounts[userIdStr][roomIdStr] =
            (unreadCounts[userIdStr][roomIdStr] || 0) + 1;
        }
      }
    } catch (error) {
      console.error("❌ [Socket] Room notify error:", error);
    }
  };

  // ==================== CONNECTION HANDLER ====================

  io.on("connection", (socket) => {
    console.log("🔌 [Socket] Connected:", socket.id);

    // -------------------- IDENTIFY --------------------
    socket.on("identify", ({ userId }) => {
      if (!userId) return;

      const userIdStr = String(userId);
      console.log("🔐 [Socket] Identify:", userIdStr);

      socketUsers.set(socket.id, {
        userId: userIdStr,
        userName: null,
        rooms: new Set(),
      });

      if (!userSockets.has(userIdStr)) {
        userSockets.set(userIdStr, new Set());
      }
      userSockets.get(userIdStr).add(socket.id);
    });

    // -------------------- USER ONLINE --------------------
    socket.on("userOnline", async ({ userId }) => {
      if (!userId) return;

      const userIdStr = String(userId);
      const wasOnline = onlineUsers.has(userIdStr);

      onlineUsers.add(userIdStr);

      if (!wasOnline) {
        console.log("🟢 [Socket] User online:", userIdStr);
        await broadcastUserStatus(userIdStr, true);
      }
    });

    // -------------------- USER OFFLINE --------------------
    socket.on("userOffline", async ({ userId }) => {
      if (!userId) return;

      const userIdStr = String(userId);

      const sockets = userSockets.get(userIdStr);
      if (sockets && sockets.size <= 1) {
        onlineUsers.delete(userIdStr);
        console.log("🔴 [Socket] User offline:", userIdStr);
        await broadcastUserStatus(userIdStr, false);
      }
    });

    // -------------------- REQUEST ROOM DATA --------------------
    // Single unified event that returns ALL room data in one batch
    socket.on("requestRoomData", async ({ userId }) => {
      if (!userId) return;

      const userIdStr = String(userId);

      if (isThrottled(userIdStr)) return;

      console.log("📋 [Socket] Room data request:", userIdStr);

      try {
        const pool = await import("./config/database.js").then((m) => m.default);
        
        // Get user's rooms with all metadata in one query
        const result = await pool.query(
          `SELECT cr."roomId", cr."roomName", cr."isactive",
                  cru."canSendMessage", cru."isAdmin"
           FROM chatrooms cr
           JOIN chatroomusers cru ON cr."roomId" = cru."roomId"
           WHERE cru."userId" = $1::integer AND cr."isactive" = 1
           ORDER BY cr."createdon" DESC`,
          [userIdStr]
        );

        // Build unified rooms data array
        const rooms = result.rows.map((room) => {
          const roomIdStr = room.roomId.toString();
          const lastMsg = lastMessages[roomIdStr];
          const userUnread = unreadCounts[userIdStr]?.[roomIdStr] || 0;
          
          // Format lastMessage for display
          let lastMessageData = null;
          if (lastMsg) {
            let displayText = lastMsg.messageText;
            if (lastMsg.messageType !== 'text') {
              // Show "shared {type}" for non-text messages
              const typeMap = {
                'media': 'media',
                'poll': 'poll',
                'table': 'table',
                'announcement': 'announcement'
              };
              displayText = `shared ${typeMap[lastMsg.messageType] || lastMsg.messageType}`;
            }
            
            lastMessageData = {
              id: lastMsg.id,
              text: displayText,
              messageType: lastMsg.messageType,
              senderName: lastMsg.sender?.userName || 'Unknown',
              senderId: lastMsg.sender?.userId,
              timestamp: lastMsg.createdAt,
            };
          }
          
          return {
            roomId: roomIdStr,
            roomName: room.roomName,
            isAdmin: room.isAdmin === true || room.isAdmin === 1,
            canSendMessage: room.canSendMessage === true || room.canSendMessage === 1,
            lastMessage: lastMessageData,
            unreadCount: userUnread,
          };
        });

        // Single unified event with all room data
        socket.emit("roomsData", { rooms });
        
      } catch (error) {
        console.error("❌ [Socket] Room data error:", error);
      }
    });

    // -------------------- JOIN ROOM --------------------
    socket.on("joinRoom", async ({ roomId, userId, userName }) => {
      if (!roomId || !userId) return;

      const roomIdStr = String(roomId);
      const userIdStr = String(userId);

      console.log("🏠 [Socket] Join room:", roomIdStr, "by", userIdStr);

      const userData = socketUsers.get(socket.id);
      if (userData) {
        userData.userName = userName;
        userData.rooms.add(roomIdStr);
      }

      socket.join(`room_${roomIdStr}`);

      if (unreadCounts[userIdStr]) {
        unreadCounts[userIdStr][roomIdStr] = 0;
      }

      const onlineInfo = await getOnlineUsersInRoom(roomId);
      socket.emit("onlineUsers", { roomId: roomIdStr, ...onlineInfo });

      try {
        const pool = await import("./config/database.js").then((m) => m.default);
        const result = await pool.query(
          `SELECT cu."userId", sm."sevakname", cu."isAdmin"
           FROM chatroomusers cu
           LEFT JOIN "SevakMaster" sm ON cu."userId"::integer = sm."seid"
           WHERE cu."roomId" = $1`,
          [roomId]
        );

        const members = result.rows.map((m) => ({
          userId: m.userId.toString(),
          fullName: m.sevakname,
          isAdmin: m.isAdmin || false,
          isOnline: onlineUsers.has(m.userId.toString()),
        }));

        socket.emit("roomMembers", { roomId: roomIdStr, members });
      } catch (error) {
        console.error("❌ [Socket] Members fetch error:", error);
      }
    });

    // -------------------- LEAVE ROOM --------------------
    socket.on("leaveRoom", ({ roomId, userId }) => {
      if (!roomId) return;

      const roomIdStr = String(roomId);
      console.log("🚪 [Socket] Leave room:", roomIdStr);

      const userData = socketUsers.get(socket.id);
      if (userData) {
        userData.rooms.delete(roomIdStr);
      }

      socket.leave(`room_${roomIdStr}`);
    });

    // -------------------- GET ROOM ONLINE USERS --------------------
    socket.on("getRoomOnlineUsers", async ({ roomId }) => {
      if (!roomId) return;

      const onlineInfo = await getOnlineUsersInRoom(roomId);
      socket.emit("roomOnlineUsers", {
        roomId: String(roomId),
        onlineUsers: onlineInfo.onlineUsers,
      });
    });

    // -------------------- SEND MESSAGE --------------------
    socket.on("sendMessage", async ({ roomId, message, sender }) => {
      if (!roomId || !message || !sender) return;

      const roomIdStr = String(roomId);
      console.log("📤 [Socket] Message in room:", roomIdStr);

      // Format reply text for display (for polls, media, etc show type name)
      let replyMessageText = message.replyMessageText || null;
      if (message.replyMessageId && message.replyMessageType) {
        if (message.replyMessageType === 'poll') {
          replyMessageText = '📊 Poll';
        } else if (message.replyMessageType === 'media') {
          replyMessageText = '📷 Media';
        } else if (message.replyMessageType === 'table') {
          replyMessageText = '📋 Table';
        } else if (message.replyMessageType === 'announcement') {
          replyMessageText = '📢 Announcement';
        }
      }

      const msgData = {
        id: message.id,
        roomId: roomIdStr,
        messageText: message.messageText,
        messageType: message.messageType || "text",
        createdAt: message.createdAt,
        sender: {
          userId: sender.userId,
          userName: sender.userName,
        },
        mediaFilesId: message.mediaFilesId || null,
        pollId: message.pollId || null,
        tableId: message.tableId || null,
        replyMessageId: message.replyMessageId || null,
        replySenderName: message.replySenderName || null,
        replyMessageText: replyMessageText,
      };

      lastMessages[roomIdStr] = msgData;

      // --------------------------------------------------
      // Mark message as read for online users currently in room
      // --------------------------------------------------
      try {
        const pool = await import("./config/database.js").then((m) => m.default);
        const messageIdInt = typeof message.id === 'number' ? message.id : parseInt(message.id, 10);
        const roomIdInt = parseInt(roomId, 10);
        const senderIdStr = String(sender.userId);

        if (!isNaN(messageIdInt) && !isNaN(roomIdInt)) {
          // Get all sockets in this room
          const roomSockets = await io.in(`room_${roomIdStr}`).fetchSockets();
          
          // Collect unique user IDs who are online and in the room
          const onlineUsersInRoom = new Set();
          
          for (const roomSocket of roomSockets) {
            const userData = socketUsers.get(roomSocket.id);
            if (userData && userData.userId && userData.rooms?.has(roomIdStr)) {
              const userIdStr = String(userData.userId);
              // Don't mark for sender (already marked in controller)
              if (userIdStr !== senderIdStr && onlineUsers.has(userIdStr)) {
                onlineUsersInRoom.add(userIdStr);
              }
            }
          }

          // Mark message as read for all online users in room
          if (onlineUsersInRoom.size > 0) {
            const userIdsArray = Array.from(onlineUsersInRoom);
            console.log(`✅ [Socket] Marking message ${messageIdInt} as read for ${userIdsArray.length} online user(s) in room ${roomIdStr}:`, userIdsArray);

            // Batch insert read status for all online users
            for (const userIdStr of userIdsArray) {
              try {
                await pool.query(
                  `INSERT INTO messagereadstatus ("messageId", "userId", "roomId", "readAt")
                   VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC')
                   ON CONFLICT ("messageId", "userId") 
                   DO UPDATE SET "readAt" = NOW() AT TIME ZONE 'UTC'`,
                  [messageIdInt, userIdStr, roomIdInt]
                );
              } catch (readError) {
                // Ignore individual errors (e.g., already marked as read)
                console.log(`⚠️ [Socket] Could not mark message as read for user ${userIdStr}:`, readError.message);
              }
            }
          }
        }
      } catch (readError) {
        // Don't break message sending if read marking fails
        console.error('❌ [Socket] Error marking message as read for online users:', readError);
      }

      io.to(`room_${roomIdStr}`).emit("newMessage", msgData);

      await notifyRoomMembers(roomIdStr, msgData, sender.userId);

      // Send notifications to offline users
      try {
        console.log("📱 [Socket] Sending chat notifications for room:", roomIdStr);
        
        // Get room name from database
        const pool = await import("./config/database.js").then((m) => m.default);
        const roomResult = await pool.query(
          'SELECT "roomName" FROM chatrooms WHERE "roomId" = $1',
          [roomId]
        );
        
        const roomName = roomResult.rows.length > 0 ? roomResult.rows[0].roomName : "Chat";
        
        // Call notification function with correct parameters
        await sendChatNotifications(
          msgData, // message
          { userId: sender.userId, userName: sender.userName }, // senderInfo
          { roomId: roomIdStr, roomName }, // roomInfo
          io, // io instance
          socketUsers, // socketToUser map
          userSockets, // userToSockets map
          onlineUsers // onlineUsers set
        );
      } catch (error) {
        console.error("❌ [Socket] Notification error:", error);
      }
    });

    // ==================== VIDEO CALL SIGNALING (UPDATED) ====================
    
    // Initiate video call - notify ALL online room members
    socket.on("video-call-initiate", async ({ roomId, roomName, callerId, callerName }) => {
      if (!roomId || !callerId) return;
      
      const roomIdStr = String(roomId);
      console.log("📹 [Socket] Video call initiated in room:", roomIdStr, "by", callerId);
      
      // Initialize call participants set
      if (!activeCallParticipants.has(roomIdStr)) {
        activeCallParticipants.set(roomIdStr, new Set());
      }
      activeCallParticipants.get(roomIdStr).add(String(callerId));
      
      // Get all online members of the room
      const onlineMembers = await getOnlineRoomMembers(roomId);
      
      console.log("📹 [Socket] Online room members:", onlineMembers);
      
      // Send notification to each online member (except caller)
      for (const memberId of onlineMembers) {
        if (memberId !== String(callerId)) {
          console.log("📹 [Socket] Sending call notification to:", memberId);
          emitToUser(memberId, "video-call-initiate", {
            roomId: roomIdStr,
            roomName: roomName || "Video Call",
            callerId: String(callerId),
            callerName: callerName || "Unknown",
          });
        }
      }
    });

    // Send SDP offer to a specific user
    socket.on("video-call-offer", ({ roomId, targetUserId, offer, callerId, callerName }) => {
      if (!roomId || !offer || !callerId || !targetUserId) return;
      
      const roomIdStr = String(roomId);
      const targetId = String(targetUserId);
      
      console.log("📹 [Socket] Video call offer from:", callerId, "to:", targetId);
      
      // Send offer only to the target user
      emitToUser(targetId, "video-call-offer", {
        roomId: roomIdStr,
        offer,
        callerId: String(callerId),
        callerName: callerName || "Unknown",
      });
    });

    // Send SDP answer to a specific user
    socket.on("video-call-answer", ({ roomId, targetUserId, answer, answererId, answererName }) => {
      if (!roomId || !answer || !answererId || !targetUserId) return;
      
      const roomIdStr = String(roomId);
      const targetId = String(targetUserId);
      
      console.log("📹 [Socket] Video call answer from:", answererId, "to:", targetId);
      
      // Send answer only to the target user
      emitToUser(targetId, "video-call-answer", {
        roomId: roomIdStr,
        answer,
        answererId: String(answererId),
        answererName: answererName || "Unknown",
      });
    });

    // Send ICE candidate to a specific user
    socket.on("video-call-ice-candidate", ({ roomId, targetUserId, candidate, senderId }) => {
      if (!roomId || !candidate || !senderId || !targetUserId) return;
      
      const roomIdStr = String(roomId);
      const targetId = String(targetUserId);
      
      // Send ICE candidate only to the target user
      emitToUser(targetId, "video-call-ice-candidate", {
        roomId: roomIdStr,
        candidate,
        senderId: String(senderId),
      });
    });

    // User joined video call - notify existing participants to create peer connections
    socket.on("video-call-user-joined", ({ roomId, userId, userName }) => {
      if (!roomId || !userId) return;
      
      const roomIdStr = String(roomId);
      const userIdStr = String(userId);
      
      console.log("📹 [Socket] User joined video call:", userIdStr, "in room:", roomIdStr);
      
      // Get existing participants
      const participants = activeCallParticipants.get(roomIdStr) || new Set();
      
      // Notify each existing participant about the new joiner
      for (const participantId of participants) {
        if (participantId !== userIdStr) {
          console.log("📹 [Socket] Notifying participant:", participantId, "about new joiner:", userIdStr);
          emitToUser(participantId, "video-call-user-joined", {
            roomId: roomIdStr,
            userId: userIdStr,
            userName: userName || "Unknown",
          });
        }
      }
      
      // Send list of existing participants to the new joiner
      const existingParticipants = Array.from(participants).filter(p => p !== userIdStr);
      emitToUser(userIdStr, "video-call-participants", {
        roomId: roomIdStr,
        participants: existingParticipants,
      });
      
      // Add new user to participants
      participants.add(userIdStr);
      activeCallParticipants.set(roomIdStr, participants);
    });

    // Get call participants
    socket.on("video-call-get-participants", ({ roomId, userId }) => {
      if (!roomId || !userId) return;
      
      const roomIdStr = String(roomId);
      const participants = activeCallParticipants.get(roomIdStr) || new Set();
      
      emitToUser(userId, "video-call-participants", {
        roomId: roomIdStr,
        participants: Array.from(participants),
      });
    });

    // End video call
    socket.on("video-call-end", ({ roomId, userId }) => {
      if (!roomId) return;
      
      const roomIdStr = String(roomId);
      const userIdStr = userId ? String(userId) : null;
      
      console.log("📹 [Socket] Video call ended in room:", roomIdStr, "by:", userIdStr);
      
      // Remove user from participants
      if (userIdStr) {
        const participants = activeCallParticipants.get(roomIdStr);
        if (participants) {
          participants.delete(userIdStr);
          
          // If no more participants, clean up
          if (participants.size === 0) {
            activeCallParticipants.delete(roomIdStr);
          }
        }
      }
      
      // Broadcast to all room members
      io.to(`room_${roomIdStr}`).emit("video-call-end", {
        roomId: roomIdStr,
        userId: userIdStr,
      });
      
      // Also notify any online members who might not be in the room
      getOnlineRoomMembers(roomIdStr).then((onlineMembers) => {
        for (const memberId of onlineMembers) {
          emitToUser(memberId, "video-call-end", {
            roomId: roomIdStr,
            userId: userIdStr,
          });
        }
      });
    });

    // Reject video call
    socket.on("video-call-reject", ({ roomId, userId, userName }) => {
      if (!roomId || !userId) return;
      
      const roomIdStr = String(roomId);
      console.log("📹 [Socket] Video call rejected in room:", roomIdStr, "by:", userId);
      
      // Broadcast to all room members
      io.to(`room_${roomIdStr}`).emit("video-call-reject", {
        roomId: roomIdStr,
        userId: String(userId),
        userName: userName || "Unknown",
      });
    });

    // -------------------- DISCONNECT --------------------
    socket.on("disconnect", async (reason) => {
      console.log("❌ [Socket] Disconnected:", socket.id, reason);

      const userData = socketUsers.get(socket.id);
      if (userData) {
        const { userId } = userData;

        // Remove from all active calls
        for (const [roomId, participants] of activeCallParticipants) {
          if (participants.has(userId)) {
            participants.delete(userId);
            
            // Notify other participants
            io.to(`room_${roomId}`).emit("video-call-user-left", {
              roomId,
              userId,
            });
            
            if (participants.size === 0) {
              activeCallParticipants.delete(roomId);
            }
          }
        }

        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            if (onlineUsers.has(userId)) {
              onlineUsers.delete(userId);
              await broadcastUserStatus(userId, false);
            }
          }
        }

        socketUsers.delete(socket.id);
      }
    });
  });

  // ==================== UTILITY FUNCTIONS ====================

  global.updateLastMessage = (roomId, message) => {
    lastMessages[String(roomId)] = message;
  };

  global.getLastMessage = (roomId) => {
    return lastMessages[String(roomId)];
  };

  global.incrementUnreadCount = (userId, roomId) => {
    const userIdStr = String(userId);
    const roomIdStr = String(roomId);
    if (!unreadCounts[userIdStr]) unreadCounts[userIdStr] = {};
    unreadCounts[userIdStr][roomIdStr] =
      (unreadCounts[userIdStr][roomIdStr] || 0) + 1;
  };

  global.clearUnreadCount = (userId, roomId) => {
    const userIdStr = String(userId);
    const roomIdStr = String(roomId);
    if (unreadCounts[userIdStr]) {
      unreadCounts[userIdStr][roomIdStr] = 0;
    }
  };

  global.emitToRoom = (roomId, event, data) => {
    io.to(`room_${String(roomId)}`).emit(event, data);
  };

  global.emitToUser = (userId, event, data) => {
    const sockets = userSockets.get(String(userId));
    if (sockets) {
      for (const sid of sockets) {
        const socket = io.sockets.sockets.get(sid);
        if (socket) {
          socket.emit(event, data);
        }
      }
    }
  };

  console.log("✅ [Socket] Setup complete");
};

export default setupSocketIO;