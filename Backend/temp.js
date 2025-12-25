// // socket.js
// // This file contains all socket.io connection handling
// import { sendChatNotifications } from "./controllers/chatNotificationController.js";

// const setupSocketIO = (io, app) => {
//   // Make io instance globally available for scheduled message service
//   global.io = io;
//   global.lastMessageByRoom = app.get('lastMessageByRoom') || {};
//   global.unreadMessagesByUser = app.get('unreadMessagesByUser') || {};
  
//   // Get the shared data from the Express app
//   const onlineUsersByRoom = app.get('onlineUsersByRoom') || {};
//   const unreadMessagesByUser = app.get('unreadMessagesByUser') || {};
//   const lastMessageByRoom = app.get('lastMessageByRoom') || {};
  
//   // Track socket to user mapping
//   const socketToUser = new Map(); // socketId -> {userId, userName, currentRooms, isOnChatTab}
//   const userToSockets = new Map(); // userId -> Set of socketIds
  
//   // Global online users tracking (userId -> boolean)
//   const globalOnlineUsers = new Set(); // Set of online userIds

//   // Initialize unread counts and last messages from database
//   const initializeRoomData = async () => {
//     try {
//       console.log("🔄 Initializing room data on server startup...");
//       const pool = await import("./config/database.js").then((m) => m.default);
      
//       // Get all rooms
//       const roomsResult = await pool.query('SELECT "roomId" FROM chatrooms');
//       console.log("total rooms", roomsResult.rows.length);
//       for (const room of roomsResult.rows) {
//         const roomId = room.roomId.toString();
        
//         // Get last message for this room
//         const lastMessageResult = await pool.query(
//           `SELECT m.*, sm."sevakname" as "senderName",
//                   m."createdAt" as "createdAt"
//            FROM chatmessages m 
//            JOIN "SevakMaster" sm ON m."senderId"::integer = sm."seid"
//            WHERE m."roomId" = $1 
//            ORDER BY m."createdAt" DESC 
//            LIMIT 1`,
//           [room.roomId]
//         );
//         console.log("lastMessageResult", lastMessageResult.rows.length);
//         if (lastMessageResult.rows.length > 0) {
//           const lastMsg = lastMessageResult.rows[0];
//           lastMessageByRoom[roomId] = {
//             id: lastMsg.id,
//             messageText: lastMsg.messageText,
//             messageType: lastMsg.messageType || 'text',
//             createdAt: lastMsg.createdAt,
//             sender: {
//               userId: lastMsg.senderId,
//               userName: lastMsg.senderName || 'Unknown'
//             },
//             mediaFilesId: lastMsg.mediaFilesId || null,
//             pollId: lastMsg.pollId || null,
//             tableId: lastMsg.tableId || null,
//             replyMessageId: lastMsg.replyMessageId || null,
//             roomId: roomId
//           };
//         }
        
//         // Get room members and initialize unread counts
//         const membersResult = await pool.query(
//           'SELECT "userId" FROM chatroomusers WHERE "roomId" = $1',
//           [room.roomId]
//         );
        
//         for (const member of membersResult.rows) {
//           const userId = member.userId;
          
//           if (!unreadMessagesByUser[userId]) {
//             unreadMessagesByUser[userId] = {};
//           }
          
//           if (!unreadMessagesByUser[userId][roomId]) {
//             // Count unread messages for this user in this room
//             // For simplicity, we'll start with 0, but you can implement logic
//             // to count actual unread messages based on last seen timestamp
//             unreadMessagesByUser[userId][roomId] = 0;
//           }
//         }
//       }
      
//       console.log("✅ Room data initialization completed");
//       console.log(`📊 Initialized ${Object.keys(lastMessageByRoom).length} rooms with last messages`);
      
//     } catch (error) {
//       console.error("❌ Error initializing room data:", error);
//     }
//   };

//   // Call initialization on startup
//   initializeRoomData();

//   // Helper function to calculate online count for a specific room
//   const getOnlineCountForRoom = async (roomId) => {
//     try {
//       const pool = await import("./config/database.js").then((m) => m.default);
//       const membersResult = await pool.query(
//         'SELECT "userId" FROM chatroomusers WHERE "roomId" = $1',
//         [roomId]
//       );
      
//       const memberIds = membersResult.rows.map(row => row.userId);
//       const onlineCount = memberIds.filter(userId => globalOnlineUsers.has(userId)).length;
      
//       return {
//         onlineCount,
//         totalMembers: memberIds.length,
//         onlineUsers: memberIds.filter(userId => globalOnlineUsers.has(userId))
//       };
//     } catch (error) {
//       console.error("Error calculating online count for room:", roomId, error);
//       return { onlineCount: 0, totalMembers: 0, onlineUsers: [] };
//     }
//   };

//   // Helper to return online userIds for a room
//   const getOnlineUsersForRoom = async (roomId) => {
//     const { onlineUsers } = await getOnlineCountForRoom(roomId);
//     return onlineUsers;
//   };

//   // Helper function to broadcast online count to ALL users for a specific room
//   const broadcastRoomOnlineCount = async (roomId) => {
//     try {
//       const onlineInfo = await getOnlineCountForRoom(roomId);
      
//       console.log(`📢 Broadcasting online count for room ${roomId}: ${onlineInfo.onlineCount}/${onlineInfo.totalMembers}`);
      
//       const payload = {
//         roomId: roomId.toString(),
//         onlineUsers: onlineInfo.onlineUsers,
//         onlineCount: onlineInfo.onlineCount,
//         totalMembers: onlineInfo.totalMembers
//       };

//       // Emit to ALL connected clients (for chat room list)
//       io.emit("onlineUsers", payload);

//       // Also emit to the specific room (for users inside the chat room)
//       io.to(`room-${roomId}`).emit("onlineUsers", payload);
//     } catch (error) {
//       console.error("Error broadcasting room online count:", error);
//     }
//   };

//   // Helper function to update room members status based on global online users
//   const updateRoomMembersStatus = async (roomId, ioInstance = io) => {
//     try {
//       const pool = await import("./config/database.js").then((m) => m.default);
//       const membersResult = await pool.query(
//         `SELECT sm."seid"::text as "userId", sm."sevakname" as "fullName", cru."isAdmin" 
//         FROM chatroomusers cru
//         JOIN "SevakMaster" sm ON cru."userId" = sm."seid"
//         WHERE cru."roomId" = $1`,
//         [roomId]
//       );

//       // Use global online status instead of per-room tracking
//       const members = membersResult.rows.map((member) => ({
//         ...member,
//         isOnline: globalOnlineUsers.has(member.userId),
//       }));

//       // Calculate online users for this room based on global status
//       const onlineUsersInRoom = members
//         .filter(m => globalOnlineUsers.has(m.userId))
//         .map(m => m.userId);

//       // Emit updated online users to all clients in the room
//       ioInstance.to(`room-${roomId}`).emit("onlineUsers", {
//         roomId,
//         onlineUsers: onlineUsersInRoom,
//         onlineCount: onlineUsersInRoom.length,
//         totalMembers: members.length,
//       });

//       // Emit the full members list with online status
//       ioInstance.to(`room-${roomId}`).emit("roomMembers", {
//         roomId,
//         members,
//       });
//     } catch (error) {
//       console.error("Error updating room members status:", error);
//     }
//   };

//   // Broadcast user online/offline status to all relevant rooms and clients
//   const broadcastUserStatusToAllRooms = async (userId, isOnline) => {
//     try {
//       const pool = await import("./config/database.js").then((m) => m.default);
//       const userRoomsResult = await pool.query(
//         'SELECT "roomId" FROM chatroomusers WHERE "userId" = $1',
//         [userId]
//       );
      
//       const userRoomIds = userRoomsResult.rows.map(row => row.roomId);
      
//       console.log(`📢 Broadcasting ${isOnline ? 'online' : 'offline'} status for user ${userId} to ${userRoomIds.length} rooms`);
      
//       // Broadcast user online status change to ALL connected clients
//       io.emit("userOnlineStatusUpdate", {
//         userId,
//         isOnline
//       });
      
//       // Update online counts for all rooms this user is part of
//       for (const roomId of userRoomIds) {
//         await broadcastRoomOnlineCount(roomId);
//         await updateRoomMembersStatus(roomId);
//       }
//     } catch (error) {
//       console.error("Error broadcasting user status to all rooms:", error);
//     }
//   };

//   // Helper function to send unread counts to a user
//   const sendUnreadCountsToUser = (userId) => {
//     const userSockets = userToSockets.get(userId) || new Set();
//     const userUnreadCounts = unreadMessagesByUser[userId] || {};
    
//     userSockets.forEach(socketId => {
//       const socket = io.sockets.sockets.get(socketId);
//       if (socket) {
//         socket.emit("unreadCounts", { unreadCounts: userUnreadCounts });
//       }
//     });
//   };

//   // Helper function to send room updates to all members
//   const sendRoomUpdateToMembers = async (roomId, messageObj) => {
//     try {
//       const pool = await import("./config/database.js").then((m) => m.default);
//       const membersResult = await pool.query(
//         'SELECT "userId" FROM chatroomusers WHERE "roomId" = $1',
//         [roomId]
//       );
      
//       const memberIds = membersResult.rows.map(row => row.userId);
//       const allConnectedSockets = await io.fetchSockets();
//       const userSocketMap = new Map();
      
//       allConnectedSockets.forEach(socket => {
//         if (socket.data?.userId) {
//           if (!userSocketMap.has(socket.data.userId)) {
//             userSocketMap.set(socket.data.userId, []);
//           }
//           userSocketMap.get(socket.data.userId).push(socket);
//         }
//       });

//       memberIds.forEach(memberId => {
//         const memberSockets = userSocketMap.get(memberId) || [];
//         const unreadCount = unreadMessagesByUser[memberId]?.[roomId] || 0;
        
//         memberSockets.forEach(memberSocket => {
//           // Send last message update
//           memberSocket.emit("lastMessage", {
//             lastMessageByRoom: {
//               [roomId]: messageObj
//             }
//           });

//           // Send room update with unread count
//           memberSocket.emit("roomUpdate", {
//             roomId,
//             lastMessage: messageObj,
//             unreadCount: unreadCount
//           });
//         });
//       });
//     } catch (error) {
//       console.error("Error sending room updates:", error);
//     }
//   };

//   // Socket.io connection handling
//   io.on("connection", async (socket) => {
//     console.log("New client connected:", socket.id);

//     socket.on("identify", async ({ userId }) => {
//       try {
//         if (!userId) {
//           console.error("Invalid identify parameters:", { userId });
//           return;
//         }

//         // Store user info with socket
//         socketToUser.set(socket.id, { userId, userName: '', currentRooms: [], isOnChatTab: false });
        
//         // Track user's sockets
//         if (!userToSockets.has(userId)) {
//           userToSockets.set(userId, new Set());
//         }
//         userToSockets.get(userId).add(socket.id);

//         socket.data = { ...socket.data, userId };
//         console.log(`Socket ${socket.id} identified as user ${userId}`);

//         // ✅ ADD THIS: Automatically set user as online when they identify
//         // Check if this is the first socket for this user
//         const userSocketCount = userToSockets.get(userId)?.size || 0;
//         if (userSocketCount === 1) {
//           console.log(`🟢 Auto-setting user ${userId} as online (first socket)`);
//           globalOnlineUsers.add(userId);

//           await broadcastUserStatusToAllRooms(userId, true);
//         }

//         // Send last messages to the user
//         console.log("Sending last messages to user:", userId);
//         socket.emit("lastMessage", { lastMessageByRoom });

//         // Send unread counts for this user
//         sendUnreadCountsToUser(userId);

//       } catch (error) {
//         console.error("Error in identify event:", error);
//       }
//     });

//     // Handle user requesting room data (when navigating to index.tsx)
//     socket.on("requestRoomData", async ({ userId }) => {
//       try {
//         if (!userId) {
//           console.error("Invalid requestRoomData parameters:", { userId });
//           return;
//         }

//         console.log(`📋 User ${userId} requested room data`);

//         // Get rooms user is part of
//         const pool = await import("./config/database.js").then((m) => m.default);
//         const userRoomsResult = await pool.query(
//           'SELECT "roomId" FROM chatroomusers WHERE "userId" = $1',
//           [userId]
//         );

//         const userRoomIds = userRoomsResult.rows.map(row => row.roomId);
        
//         // Filter last messages for user's rooms only
//         const userLastMessages = {};
//         userRoomIds.forEach(roomId => {
//           const roomIdStr = roomId.toString();
//           if (lastMessageByRoom[roomIdStr]) {
//             userLastMessages[roomIdStr] = lastMessageByRoom[roomIdStr];
//           }
//         });

//         // Send last messages for user's rooms
//         socket.emit("lastMessage", { lastMessageByRoom: userLastMessages });

//         // Send unread counts for this user
//         sendUnreadCountsToUser(userId);

//         // Send initial online counts for all user's rooms
//         for (const roomId of userRoomIds) {
//           const onlineInfo = await getOnlineCountForRoom(roomId);
//           socket.emit("onlineUsers", {
//             roomId: roomId.toString(),
//             onlineUsers: onlineInfo.onlineUsers,
//             onlineCount: onlineInfo.onlineCount,
//             totalMembers: onlineInfo.totalMembers
//           });
//         }

//         console.log(`✅ Sent room data to user ${userId} for ${userRoomIds.length} rooms`);

//       } catch (error) {
//         console.error("Error in requestRoomData event:", error);
//       }
//     });

//     // Handle user joining a chat room
//     socket.on("joinRoom", async ({ roomId, userId, userName }) => {
//       try {
//         if (!roomId || !userId) {
//           console.error("Invalid joinRoom parameters:", { roomId, userId, userName });
//           return;
//         }

//         console.log(`👤 User ${userName} (${userId}) joining room ${roomId}`);

//         // Update socket user info
//         const userInfo = socketToUser.get(socket.id) || { userId, userName, currentRooms: [], isOnChatTab: false };
//         userInfo.userName = userName;
//         userInfo.isOnChatTab = true; // User is on chat tab when joining a room
//         if (!userInfo.currentRooms.includes(roomId)) {
//           userInfo.currentRooms.push(roomId);
//         }
//         socketToUser.set(socket.id, userInfo);

//         // Join the socket room
//         socket.join(`room-${roomId}`);

//         // Clear unread messages for this user in this room
//         if (unreadMessagesByUser[userId] && unreadMessagesByUser[userId][roomId]) {
//           unreadMessagesByUser[userId][roomId] = 0;
//           // Send updated unread counts
//           sendUnreadCountsToUser(userId);
//         }

//         // Broadcast current online count for this room (using global status)
//         await broadcastRoomOnlineCount(roomId);

//         // Update room members with online status
//         await updateRoomMembersStatus(roomId, io);

//         console.log(`✅ User ${userName} successfully joined room ${roomId}`);

//       } catch (error) {
//         console.error("Error in joinRoom event:", error);
//       }
//     });

//     // Handle user leaving a chat room
//     socket.on("leaveRoom", async ({ roomId, userId }) => {
//       try {
//         if (!roomId || !userId) {
//           console.error("Invalid leaveRoom parameters:", { roomId, userId });
//           return;
//         }

//         console.log(`👤 User ${userId} leaving room ${roomId}`);

//         socket.leave(`room-${roomId}`);

//         // Update socket user info
//         const userInfo = socketToUser.get(socket.id);
//         if (userInfo) {
//           userInfo.currentRooms = userInfo.currentRooms.filter(r => r !== roomId);
//           socketToUser.set(socket.id, userInfo);
//         }

//         console.log(`✅ User ${userId} left room ${roomId}`);

//         // Note: We don't change global online status when leaving a room
//         // The user is still online globally, just not viewing this specific room anymore

//       } catch (error) {
//         console.error("Error in leaveRoom event:", error);
//       }
//     });

//     socket.on('getRoomOnlineUsers', async ({ roomId }) => {
//       try {
//         const onlineUsers = await getOnlineUsersForRoom(roomId);
//         socket.emit('roomOnlineUsers', { roomId, onlineUsers });
//       } catch (error) {
//         console.error('Error getting room online users:', error);
//       }
//     });

//     // Handle sending messages
//     socket.on("sendMessage", async ({ roomId, message, sender }) => {
//       try {
//         console.log(`New message in room ${roomId} from ${sender.userName}`);

//         // Create the message object
//         const messageObj = {
//           id: message.id,
//           messageText: message.messageText,
//           messageType: message.messageType || 'text',
//           createdAt: message.createdAt,
//           sender: {
//             userId: sender.userId,
//             userName: sender.userName,
//           },
//           mediaFilesId: message.mediaFilesId || null,
//           pollId: message.pollId || null,
//           tableId: message.tableId || null,
//           replyMessageId: message.replyMessageId || null,
//           roomId: roomId
//         };

//         // Save the last message
//         lastMessageByRoom[roomId] = messageObj;

//         // Get room members from DB
//         const pool = await import("./config/database.js").then((m) => m.default);
//         const membersResult = await pool.query(
//           `SELECT "userId" FROM chatroomusers WHERE "roomId" = $1`,
//           [roomId]
//         );
//         const memberIds = membersResult.rows.map((row) => row.userId);

//         // Get online users in this room
//         const onlineUsersInRoom = onlineUsersByRoom[roomId] || new Set();

//         // Update unread counts for offline users (users not currently in the room)
//         memberIds.forEach((memberId) => {
//           if (memberId !== sender.userId && !onlineUsersInRoom.has(memberId)) {
//             // Initialize unread count structure if needed
//             if (!unreadMessagesByUser[memberId]) {
//               unreadMessagesByUser[memberId] = {};
//             }
//             if (!unreadMessagesByUser[memberId][roomId]) {
//               unreadMessagesByUser[memberId][roomId] = 0;
//             }
//             unreadMessagesByUser[memberId][roomId]++;
//           }
//         });

//         // Broadcast to all users in the room (except sender)
//         const socketsInRoom = await io.in(`room-${roomId}`).fetchSockets();
//         for (const otherSocket of socketsInRoom) {
//           if (otherSocket.id !== socket.id) {
//             otherSocket.emit("newMessage", messageObj);
//           }
//         }

//         // Send room updates to all members (including those not in the room)
//         await sendRoomUpdateToMembers(roomId, messageObj);

//         // Send chat notifications to users who need them
//         try {
//           // Get room information for notifications
//           const pool = await import("./config/database.js").then((m) => m.default);
//           const roomResult = await pool.query(
//             'SELECT "roomName" FROM chatrooms WHERE "roomId" = $1',
//             [roomId]
//           );
          
//           if (roomResult.rows.length > 0) {
//             const roomInfo = {
//               roomId: roomId,
//               roomName: roomResult.rows[0].roomName
//             };
            
//             await sendChatNotifications(
//               message, 
//               sender, 
//               roomInfo, 
//               io, 
//               socketToUser, 
//               userToSockets
//             );
//           }
//         } catch (notificationError) {
//           console.error('Error sending chat notifications:', notificationError);
//         }

//         console.log(`Message sent to room ${roomId}, online users: ${onlineUsersInRoom.size}`);
//       } catch (error) {
//         console.error("Error in sendMessage event:", error);
//       }
//     });

//     // Handle user entering chat tab
//     socket.on("enterChatTab", ({ userId }) => {
//       try {
//         if (!userId) {
//           console.error("Invalid enterChatTab parameters:", { userId });
//           return;
//         }

//         const userInfo = socketToUser.get(socket.id);
//         if (userInfo && userInfo.userId === userId) {
//           userInfo.isOnChatTab = true;
//           socketToUser.set(socket.id, userInfo);
//           console.log(`User ${userId} entered chat tab`);
//         }
//       } catch (error) {
//         console.error("Error in enterChatTab event:", error);
//       }
//     });

//     // Handle user leaving chat tab
//     socket.on("leaveChatTab", ({ userId }) => {
//       try {
//         if (!userId) {
//           console.error("Invalid leaveChatTab parameters:", { userId });
//           return;
//         }

//         const userInfo = socketToUser.get(socket.id);
//         if (userInfo && userInfo.userId === userId) {
//           userInfo.isOnChatTab = false;
//           userInfo.currentRooms = []; // Clear current rooms when leaving chat tab
//           socketToUser.set(socket.id, userInfo);
//           console.log(`User ${userId} left chat tab`);
//         }
//       } catch (error) {
//         console.error("Error in leaveChatTab event:", error);
//       }
//     });

//     // Handle global user online status
//     socket.on("userOnline", async ({ userId }) => {
//       try {
//         if (!userId) {
//           console.error("Invalid userOnline parameters:", { userId });
//           return;
//         }

//         console.log(`✅ User ${userId} is now ONLINE (globally)`);
        
//         // Add to global online users
//         globalOnlineUsers.add(userId);
//         await broadcastUserStatusToAllRooms(userId, true);

//       } catch (error) {
//         console.error("Error in userOnline event:", error);
//       }
//     });

//     // Handle global user offline status
//     socket.on("userOffline", async ({ userId }) => {
//       try {
//         if (!userId) {
//           console.error("Invalid userOffline parameters:", { userId });
//           return;
//         }

//         console.log(`❌ User ${userId} is now OFFLINE (globally)`);
        
//         // Remove from global online users
//         globalOnlineUsers.delete(userId);
//         await broadcastUserStatusToAllRooms(userId, false);

//       } catch (error) {
//         console.error("Error in userOffline event:", error);
//       }
//     });

//     // Handle disconnection
//     socket.on("disconnect", async () => {
//       console.log("Client disconnected:", socket.id);

//       try {
//         const userInfo = socketToUser.get(socket.id);
//         if (userInfo) {
//           const { userId, currentRooms } = userInfo;

//           // Remove socket from user's socket list
//           if (userToSockets.has(userId)) {
//             userToSockets.get(userId).delete(socket.id);
//             if (userToSockets.get(userId).size === 0) {
//               userToSockets.delete(userId);
//             }
//           }

//           // Check if user has other connected sockets
//           const hasOtherSockets = userToSockets.has(userId) && userToSockets.get(userId).size > 0;

//           // Clean up global online status only if user has no other connected sockets
//           if (!hasOtherSockets) {
//             console.log(`❌ User ${userId} has no more connected sockets, setting offline globally`);
            
//             // Remove from global online users
//             globalOnlineUsers.delete(userId);
//             await broadcastUserStatusToAllRooms(userId, false);
//           }

//           // Clean up socket mapping
//           socketToUser.delete(socket.id);
//         }
//       } catch (error) {
//         console.error("Error handling disconnect:", error);
//       }
//     });

//   });
// };

// export default setupSocketIO;