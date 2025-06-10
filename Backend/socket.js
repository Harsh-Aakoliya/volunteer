// socket.js
// This file contains all socket.io connection handling

const setupSocketIO = (io, app) => {
  // Get the shared data from the Express app
  const onlineUsersByRoom = app.get('onlineUsersByRoom') || {};
  const unreadMessagesByUser = app.get('unreadMessagesByUser') || {};
  const lastMessageByRoom = app.get('lastMessageByRoom') || {};
  
  // Track socket to user mapping
  const socketToUser = new Map(); // socketId -> {userId, userName, currentRooms}
  const userToSockets = new Map(); // userId -> Set of socketIds

  // Socket.io connection handling
  io.on("connection", async (socket) => {
    console.log("New client connected:", socket.id);

    // Handle user identification
    socket.on("identify", async ({ userId }) => {
      try {
        if (!userId) {
          console.error("Invalid identify parameters:", { userId });
          return;
        }

        // Store user info with socket
        socketToUser.set(socket.id, { userId, userName: '', currentRooms: [] });
        
        // Track user's sockets
        if (!userToSockets.has(userId)) {
          userToSockets.set(userId, new Set());
        }
        userToSockets.get(userId).add(socket.id);

        socket.data = { ...socket.data, userId };
        console.log(`Socket ${socket.id} identified as user ${userId}`);

        // Send last messages to the user
        console.log("Sending last messages to user:", userId);
        socket.emit("lastMessage", { lastMessageByRoom });

        // Send unread counts for this user
        const userUnreadCounts = unreadMessagesByUser[userId] || {};
        socket.emit("unreadCounts", { unreadCounts: userUnreadCounts });

      } catch (error) {
        console.error("Error in identify event:", error);
      }
    });

    // Handle user joining a chat room
    socket.on("joinRoom", async ({ roomId, userId, userName }) => {
      try {
        if (!roomId || !userId) {
          console.error("Invalid joinRoom parameters:", { roomId, userId, userName });
          return;
        }

        // Update socket user info
        const userInfo = socketToUser.get(socket.id) || { userId, userName, currentRooms: [] };
        userInfo.userName = userName;
        if (!userInfo.currentRooms.includes(roomId)) {
          userInfo.currentRooms.push(roomId);
        }
        socketToUser.set(socket.id, userInfo);

        // Join the socket room
        socket.join(`room-${roomId}`);
        
        // Initialize room in onlineUsers if not exists
        if (!onlineUsersByRoom[roomId]) {
          onlineUsersByRoom[roomId] = new Set();
        }

        // Add user to online users for this room
        onlineUsersByRoom[roomId].add(userId);

        console.log(`User ${userName} (${userId}) joined room ${roomId}`);
        console.log(`Room ${roomId} online users:`, Array.from(onlineUsersByRoom[roomId]));

        // Clear unread messages for this user in this room
        if (unreadMessagesByUser[userId] && unreadMessagesByUser[userId][roomId]) {
          unreadMessagesByUser[userId][roomId] = 0;
        }

        // Get all members for this room from the database
        const pool = await import("./config/database.js").then((m) => m.default);
        const membersResult = await pool.query(
          `SELECT u."userId", u."fullName", cru."isAdmin" 
          FROM chatroomusers cru
          JOIN "users" u ON cru."userId" = u."userId"
          WHERE cru."roomId" = $1`,
          [roomId]
        );

        // Create members list with online status
        const members = membersResult.rows.map((member) => ({
          ...member,
          isOnline: onlineUsersByRoom[roomId]?.has(member.userId) || false,
        }));

        // Emit updated online users to all clients in the room
        io.to(`room-${roomId}`).emit("onlineUsers", {
          roomId,
          onlineUsers: Array.from(onlineUsersByRoom[roomId]),
          onlineCount: onlineUsersByRoom[roomId].size,
          totalMembers: members.length,
        });

        // Emit the full members list with online status
        io.to(`room-${roomId}`).emit("roomMembers", {
          roomId,
          members,
        });

        // Notify user they've joined successfully
        socket.emit("joinedRoom", {
          roomId,
          onlineCount: onlineUsersByRoom[roomId].size,
          totalMembers: members.length,
        });

      } catch (error) {
        console.error("Error in joinRoom event:", error);
      }
    });

    // Handle user leaving a chat room
    socket.on("leaveRoom", async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) {
          console.error("Invalid leaveRoom parameters:", { roomId, userId });
          return;
        }

        socket.leave(`room-${roomId}`);

        // Update socket user info
        const userInfo = socketToUser.get(socket.id);
        if (userInfo) {
          userInfo.currentRooms = userInfo.currentRooms.filter(r => r !== roomId);
          socketToUser.set(socket.id, userInfo);
        }

        // Check if user has any other sockets in this room
        const userSockets = userToSockets.get(userId) || new Set();
        let userStillInRoom = false;
        
        for (const socketId of userSockets) {
          if (socketId !== socket.id) {
            const otherUserInfo = socketToUser.get(socketId);
            if (otherUserInfo && otherUserInfo.currentRooms.includes(roomId)) {
              userStillInRoom = true;
              break;
            }
          }
        }

        // Only remove user from online list if they have no other sockets in this room
        if (!userStillInRoom && onlineUsersByRoom[roomId]) {
          onlineUsersByRoom[roomId].delete(userId);

          // If room is empty, clean up
          if (onlineUsersByRoom[roomId].size === 0) {
            delete onlineUsersByRoom[roomId];
          } else {
            await updateRoomMembersStatus(roomId, io);
          }
        }

        console.log(`User ${userId} left room ${roomId}`);

      } catch (error) {
        console.error("Error in leaveRoom event:", error);
      }
    });

    // Handle sending messages
    socket.on("sendMessage", async ({ roomId, message, sender, mediaFilesId, pollId, tableId }) => {
      try {
        console.log(`New message in room ${roomId} from ${sender.userName}`);

        // Create the message object
        const messageObj = {
          id: message.id,
          messageText: message.messageText,
          messageType: message.messageType || 'text',
          createdAt: message.createdAt,
          sender: {
            userId: sender.userId,
            userName: sender.userName,
          },
          mediaFilesId: mediaFilesId || null,
          pollId: pollId || null,
          tableId: tableId || null,
        };

        // Save the last message
        lastMessageByRoom[roomId] = messageObj;

        // Get room members from DB
        const pool = await import("./config/database.js").then((m) => m.default);
        const membersResult = await pool.query(
          `SELECT "userId" FROM chatroomusers WHERE "roomId" = $1`,
          [roomId]
        );
        const memberIds = membersResult.rows.map((row) => row.userId);

        // Get online users in this room
        const onlineUsersInRoom = onlineUsersByRoom[roomId] || new Set();

        // Update unread counts for offline users (users not currently in the room)
        memberIds.forEach((memberId) => {
          if (memberId !== sender.userId && !onlineUsersInRoom.has(memberId)) {
            // Initialize unread count structure if needed
            if (!unreadMessagesByUser[memberId]) {
              unreadMessagesByUser[memberId] = {};
            }
            if (!unreadMessagesByUser[memberId][roomId]) {
              unreadMessagesByUser[memberId][roomId] = 0;
            }
            unreadMessagesByUser[memberId][roomId]++;
            
            console.log(`Incremented unread count for user ${memberId} in room ${roomId}: ${unreadMessagesByUser[memberId][roomId]}`);
          }
        });

        // Broadcast to all users in the room (except sender)
        const socketsInRoom = await io.in(`room-${roomId}`).fetchSockets();
        for (const otherSocket of socketsInRoom) {
          if (otherSocket.id !== socket.id) {
            otherSocket.emit("newMessage", messageObj);
          }
        }

        // Send lastMessage update to all room members (even those not currently in the room)
        const allConnectedSockets = await io.fetchSockets();
        const userSocketMap = new Map();
        
        allConnectedSockets.forEach(socket => {
          if (socket.data?.userId) {
            if (!userSocketMap.has(socket.data.userId)) {
              userSocketMap.set(socket.data.userId, []);
            }
            userSocketMap.get(socket.data.userId).push(socket);
          }
        });

        // Send updates to all room members
        memberIds.forEach(memberId => {
          const memberSockets = userSocketMap.get(memberId) || [];
          const unreadCount = unreadMessagesByUser[memberId]?.[roomId] || 0;
          
          memberSockets.forEach(memberSocket => {
            // Send last message update
            memberSocket.emit("lastMessage", {
              lastMessageByRoom: {
                [roomId]: messageObj
              }
            });

            // Send unread count update (only if user is not the sender)
            if (memberId !== sender.userId) {
              memberSocket.emit("unreadUpdate", {
                roomId,
                unreadCount,
                lastMessage: messageObj,
              });
            }
          });
        });

        console.log(`Message sent to room ${roomId}, online users: ${onlineUsersInRoom.size}`);

      } catch (error) {
        console.error("Error in sendMessage event:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);

      try {
        const userInfo = socketToUser.get(socket.id);
        if (userInfo) {
          const { userId, currentRooms } = userInfo;

          // Remove socket from user's socket list
          if (userToSockets.has(userId)) {
            userToSockets.get(userId).delete(socket.id);
            if (userToSockets.get(userId).size === 0) {
              userToSockets.delete(userId);
            }
          }

          // Check if user has other connected sockets
          const hasOtherSockets = userToSockets.has(userId) && userToSockets.get(userId).size > 0;

          // Clean up rooms only if user has no other connected sockets
          if (!hasOtherSockets) {
            for (const roomId of currentRooms) {
              if (onlineUsersByRoom[roomId]) {
                onlineUsersByRoom[roomId].delete(userId);

                if (onlineUsersByRoom[roomId].size === 0) {
                  delete onlineUsersByRoom[roomId];
                } else {
                  await updateRoomMembersStatus(roomId, io);
                }
              }
            }
          }

          // Clean up socket mapping
          socketToUser.delete(socket.id);
        }
      } catch (error) {
        console.error("Error handling disconnect:", error);
      }
    });

    // Helper function to update room members status
    const updateRoomMembersStatus = async (roomId, io) => {
      try {
        const pool = await import("./config/database.js").then((m) => m.default);
        const membersResult = await pool.query(
          `SELECT u."userId", u."fullName", cru."isAdmin" 
          FROM chatroomusers cru
          JOIN "users" u ON cru."userId" = u."userId"
          WHERE cru."roomId" = $1`,
          [roomId]
        );

        const members = membersResult.rows.map((member) => ({
          ...member,
          isOnline: onlineUsersByRoom[roomId]?.has(member.userId) || false,
        }));

        // Emit updated online users to all clients in the room
        io.to(`room-${roomId}`).emit("onlineUsers", {
          roomId,
          onlineUsers: Array.from(onlineUsersByRoom[roomId] || []),
          onlineCount: (onlineUsersByRoom[roomId] || new Set()).size,
          totalMembers: members.length,
        });

        // Emit the full members list with online status
        io.to(`room-${roomId}`).emit("roomMembers", {
          roomId,
          members,
        });

      } catch (error) {
        console.error("Error updating room members status:", error);
      }
    };
  });
};

export default setupSocketIO;