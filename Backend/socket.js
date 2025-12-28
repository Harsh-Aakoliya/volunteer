// Backend/socket.js
// Clean Socket.IO server implementation

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
  const lastMessages = {};

  // Map: userId -> { roomId: unreadCount }
  const unreadCounts = {};

  // Throttle: userId -> lastRequestTime
  const requestThrottle = new Map();

  // Make globally accessible
  global.lastMessageByRoom = lastMessages;
  global.unreadMessagesByUser = unreadCounts;

  // ==================== INITIALIZATION ====================

  const initializeData = async () => {
    try {
      console.log("🔄 [Socket] Initializing room data...");
      const pool = await import("./config/database.js").then((m) => m.default);

      // Load all rooms
      const roomsResult = await pool.query('SELECT "roomId" FROM chatrooms');

      for (const { roomId } of roomsResult.rows) {
        const roomIdStr = roomId.toString();

        // Get last message
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

        // Initialize unread counts for members
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

      // Broadcast to all rooms the user is in
      for (const { roomId } of result.rows) {
        const roomIdStr = roomId.toString();
        io.to(`room_${roomIdStr}`).emit("userOnlineStatusUpdate", {
          userId,
          isOnline,
        });

        // Send updated online count
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
          // User is connected
          const isInRoom = Array.from(sockets).some((sid) => {
            const userData = socketUsers.get(sid);
            return userData?.rooms?.has(roomIdStr);
          });

          // Update unread count if not in room
          if (!isInRoom && userIdStr !== senderId) {
            if (!unreadCounts[userIdStr]) unreadCounts[userIdStr] = {};
            unreadCounts[userIdStr][roomIdStr] =
              (unreadCounts[userIdStr][roomIdStr] || 0) + 1;
          }

          // Send update to all user's sockets
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
          // User offline - increment unread
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

      // Store socket -> user mapping
      socketUsers.set(socket.id, {
        userId: userIdStr,
        userName: null,
        rooms: new Set(),
      });

      // Store user -> sockets mapping
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

      // Only set offline if no other sockets for this user
      const sockets = userSockets.get(userIdStr);
      if (sockets && sockets.size <= 1) {
        onlineUsers.delete(userIdStr);
        console.log("🔴 [Socket] User offline:", userIdStr);
        await broadcastUserStatus(userIdStr, false);
      }
    });

    // -------------------- REQUEST ROOM DATA --------------------
    socket.on("requestRoomData", async ({ userId }) => {
      if (!userId) return;

      const userIdStr = String(userId);

      // Throttle requests
      if (isThrottled(userIdStr)) return;

      console.log("📋 [Socket] Room data request:", userIdStr);

      try {
        const pool = await import("./config/database.js").then((m) => m.default);
        const result = await pool.query(
          'SELECT "roomId" FROM chatroomusers WHERE "userId" = $1',
          [userIdStr]
        );

        // Send last messages
        const userLastMessages = {};
        for (const { roomId } of result.rows) {
          const roomIdStr = roomId.toString();
          if (lastMessages[roomIdStr]) {
            userLastMessages[roomIdStr] = lastMessages[roomIdStr];
          }
        }
        socket.emit("lastMessage", { lastMessageByRoom: userLastMessages });

        // Send unread counts
        sendUnreadCounts(socket, userIdStr);

        // Send online info for each room
        for (const { roomId } of result.rows) {
          const onlineInfo = await getOnlineUsersInRoom(roomId);
          socket.emit("onlineUsers", {
            roomId: roomId.toString(),
            ...onlineInfo,
          });
        }
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

      // Update socket data
      const userData = socketUsers.get(socket.id);
      if (userData) {
        userData.userName = userName;
        userData.rooms.add(roomIdStr);
      }

      // Join socket.io room
      socket.join(`room_${roomIdStr}`);

      // Clear unread count for this room
      if (unreadCounts[userIdStr]) {
        unreadCounts[userIdStr][roomIdStr] = 0;
      }

      // Send online users
      const onlineInfo = await getOnlineUsersInRoom(roomId);
      socket.emit("onlineUsers", { roomId: roomIdStr, ...onlineInfo });

      // Send room members with online status
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
          fullName: m.fullName,
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

      // Update socket data
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
      };

      // Update last message
      lastMessages[roomIdStr] = msgData;

      // Broadcast to room (except sender)
      socket.to(`room_${roomIdStr}`).emit("newMessage", msgData);

      // Notify all room members (update unread counts)
      await notifyRoomMembers(roomIdStr, msgData, sender.userId);

      // Send push notifications
      try {
        await sendChatNotifications(roomIdStr, msgData, sender.userId);
      } catch (error) {
        console.error("❌ [Socket] Notification error:", error);
      }
    });

    // -------------------- DISCONNECT --------------------
    socket.on("disconnect", async (reason) => {
      console.log("❌ [Socket] Disconnected:", socket.id, reason);

      const userData = socketUsers.get(socket.id);
      if (userData) {
        const { userId } = userData;

        // Remove socket from user's sockets
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            // User has no more connections - set offline
            if (onlineUsers.has(userId)) {
              onlineUsers.delete(userId);
              await broadcastUserStatus(userId, false);
            }
          }
        }

        // Remove socket data
        socketUsers.delete(socket.id);
      }
    });
  });

  // ==================== UTILITY FUNCTIONS ====================

  // Update last message (called from API)
  global.updateLastMessage = (roomId, message) => {
    lastMessages[String(roomId)] = message;
  };

  // Get last message
  global.getLastMessage = (roomId) => {
    return lastMessages[String(roomId)];
  };

  // Increment unread count (called from API)
  global.incrementUnreadCount = (userId, roomId) => {
    const userIdStr = String(userId);
    const roomIdStr = String(roomId);
    if (!unreadCounts[userIdStr]) unreadCounts[userIdStr] = {};
    unreadCounts[userIdStr][roomIdStr] =
      (unreadCounts[userIdStr][roomIdStr] || 0) + 1;
  };

  // Clear unread count
  global.clearUnreadCount = (userId, roomId) => {
    const userIdStr = String(userId);
    const roomIdStr = String(roomId);
    if (unreadCounts[userIdStr]) {
      unreadCounts[userIdStr][roomIdStr] = 0;
    }
  };

  // Emit to room
  global.emitToRoom = (roomId, event, data) => {
    io.to(`room_${String(roomId)}`).emit(event, data);
  };

  // Emit to user
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
