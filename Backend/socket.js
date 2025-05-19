// socket.js
// This file contains all socket.io connection handling

const setupSocketIO = (io, app) => {
  // Get the shared data from the Express app
  const onlineUsersByRoom = app.get('onlineUsersByRoom') || {};
  const unreadMessagesByUser = app.get('unreadMessagesByUser') || {};
  const lastMessageByRoom = app.get('lastMessageByRoom') || {};

  // Socket.io connection handling
  io.on("connection", async (socket) => {
    console.log("New client connected:", socket.id);
    let currentUser = null;
    let currentRooms = [];

    // Handle user joining a chat room
    socket.on("joinRoom", async ({ roomId, userId, userName }) => {
      try {
        if (!roomId || !userId) {
          console.error("Invalid joinRoom parameters:", {
            roomId,
            userId,
            userName,
          });
          return;
        }

        currentUser = { userId, userName };

        // Join the socket room
        socket.join(`room-${roomId}`);
        currentRooms.push(roomId);
        
        // Initialize room in onlineUsers if not exists
        if (!onlineUsersByRoom[roomId]) {
          onlineUsersByRoom[roomId] = new Set();
        }

        // Add user to online users for this room
        onlineUsersByRoom[roomId].add(userId);

        console.log(`User ${userName} (${userId}) joined room ${roomId}`);
        console.log(
          `Room ${roomId} online users:`,
          Array.from(onlineUsersByRoom[roomId])
        );

        // Clear unread messages for this user in this room
        if (
          unreadMessagesByUser[userId] &&
          unreadMessagesByUser[userId][roomId]
        ) {
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
          totalMembers: members.length,
        });

        // Emit the full members list with online status
        io.to(`room-${roomId}`).emit("roomMembers", {
          roomId,
          members,
        });

        // Send last message for this room if exists
        if (lastMessageByRoom[roomId]) {
          socket.emit("lastMessage", {
            roomId,
            message: lastMessageByRoom[roomId],
          });
        }
      } catch (error) {
        console.error("Error in joinRoom event:", error);
      }
    });

    // Handle user leaving a chat room
    socket.on("leaveRoom", async ({ roomId, userId }) => {
      if (roomId && userId) {
        socket.leave(`room-${roomId}`);

        // Remove user from online users for this room
        if (onlineUsersByRoom[roomId]) {
          onlineUsersByRoom[roomId].delete(userId);

          // If room is empty, clean up
          if (onlineUsersByRoom[roomId].size === 0) {
            delete onlineUsersByRoom[roomId];
          } else {
            try {
              // Get all members for this room from the database
              const pool = await import("./config/database.js").then(
                (m) => m.default
              );
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
                totalMembers: members.length,
              });

              // Emit the full members list with online status
              io.to(`room-${roomId}`).emit("roomMembers", {
                roomId,
                members,
              });

              // Emit user offline event
              io.to(`room-${roomId}`).emit("userOffline", {
                roomId,
                userId,
              });
            } catch (error) {
              console.error("Error updating room members on leave:", error);
            }
          }
        }

        // Remove from current rooms
        currentRooms = currentRooms.filter((r) => r !== roomId);
        console.log(`User ${userId} left room ${roomId}`);
      }
    });

    // Handle new message
    socket.on("sendMessage", async ({ roomId, message, sender }) => {
      try {
        console.log(
          `New message in room ${roomId} from ${sender.userName}`
        );

        // Store as last message for this room
        lastMessageByRoom[roomId] = {
          ...message,
          sender,
        };

        // Get all members of the room
        const pool = await import("./config/database.js").then((m) => m.default);
        const membersResult = await pool.query(
          `SELECT "userId" FROM chatroomusers WHERE "roomId" = $1`,
          [roomId]
        );

        const memberIds = membersResult.rows.map((row) => row.userId);

        // Create a standardized message object to broadcast
        const broadcastMessage = {
          id: message.id,
          roomId: roomId,
          messageText: message.messageText,
          mediaFiles: message.mediaFiles, // Include media files
          createdAt: message.createdAt,
          sender: {
            userId: sender.userId,
            userName: sender.userName,
          },
        };

        // Find all sockets in the room EXCEPT the sender's socket
        const socketsInRoom = await io.in(`room-${roomId}`).fetchSockets();
        const otherSockets = socketsInRoom.filter((s) => s.id !== socket.id);

        // Track which users have already been notified to avoid duplicates
        const notifiedUsers = new Set();

        // Broadcast the message only to other sockets in the room
        for (const otherSocket of otherSockets) {
          otherSocket.emit("newMessage", broadcastMessage);

          // Get the user ID associated with this socket
          const socketUserId = otherSocket.data?.userId;

          if (
            socketUserId &&
            socketUserId !== sender.userId &&
            !notifiedUsers.has(socketUserId)
          ) {
            // Mark this user as notified
            notifiedUsers.add(socketUserId);

            // Initialize unread counts if needed
            if (!unreadMessagesByUser[socketUserId]) {
              unreadMessagesByUser[socketUserId] = {};
            }
            if (!unreadMessagesByUser[socketUserId][roomId]) {
              unreadMessagesByUser[socketUserId][roomId] = 0;
            }

            // Increment unread count only once per user
            unreadMessagesByUser[socketUserId][roomId]++;

            // Send unread count update
            otherSocket.emit("unreadMessages", {
              roomId,
              count: unreadMessagesByUser[socketUserId][roomId],
              lastMessage: lastMessageByRoom[roomId],
            });

            // Send room update
            otherSocket.emit("roomUpdate", {
              roomId,
              lastMessage: lastMessageByRoom[roomId],
              unreadCount: unreadMessagesByUser[socketUserId][roomId] || 0,
            });
          }
        }

        // For users who are not currently in the room but are members
        // (they won't have sockets in the room)
        memberIds.forEach((memberId) => {
          if (memberId !== sender.userId && !notifiedUsers.has(memberId)) {
            // Initialize unread counts if needed
            if (!unreadMessagesByUser[memberId]) {
              unreadMessagesByUser[memberId] = {};
            }
            if (!unreadMessagesByUser[memberId][roomId]) {
              unreadMessagesByUser[memberId][roomId] = 0;
            }

            // Increment unread count
            unreadMessagesByUser[memberId][roomId]++;

            // Find all sockets for this user
            const userSockets = Array.from(io.sockets.sockets.values()).filter(
              (s) => s.data && s.data.userId === memberId
            );

            userSockets.forEach((userSocket) => {
              // Send unread count update
              userSocket.emit("unreadMessages", {
                roomId,
                count: unreadMessagesByUser[memberId][roomId],
                lastMessage: lastMessageByRoom[roomId],
              });

              // Send room update
              userSocket.emit("roomUpdate", {
                roomId,
                lastMessage: lastMessageByRoom[roomId],
                unreadCount: unreadMessagesByUser[memberId][roomId] || 0,
              });
            });
          }
        });
      } catch (error) {
        console.error("Error in sendMessage event:", error);
      }
    });

    // Store user ID in socket data for later reference
    socket.on("identify", ({ userId }) => {
      if (userId) {
        socket.data = { ...socket.data, userId };
        console.log(`Socket ${socket.id} identified as user ${userId}`);

        // Emit user status change to all rooms this user is a member of
        emitUserStatusChange(userId, true);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);

      // Clean up all rooms this user was in
      if (currentUser) {
        for (const roomId of currentRooms) {
          if (onlineUsersByRoom[roomId]) {
            onlineUsersByRoom[roomId].delete(currentUser.userId);

            // If room is empty, clean up
            if (onlineUsersByRoom[roomId].size === 0) {
              delete onlineUsersByRoom[roomId];
            } else {
              try {
                // Get all members for this room from the database
                const pool = await import("./config/database.js").then(
                  (m) => m.default
                );
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
                  isOnline:
                    onlineUsersByRoom[roomId]?.has(member.userId) || false,
                }));

                // Emit updated online users to all clients in the room
                io.to(`room-${roomId}`).emit("onlineUsers", {
                  roomId,
                  onlineUsers: Array.from(onlineUsersByRoom[roomId]),
                  totalMembers: members.length,
                });

                // Emit the full members list with online status
                io.to(`room-${roomId}`).emit("roomMembers", {
                  roomId,
                  members,
                });

                // Emit user offline event
                io.to(`room-${roomId}`).emit("userOffline", {
                  roomId,
                  userId: currentUser.userId,
                });
              } catch (error) {
                console.error(
                  "Error updating room members on disconnect:",
                  error
                );
              }
            }
          }
        }

        // Emit user status change to all rooms this user is a member of
        emitUserStatusChange(currentUser.userId, false);
      }
    });

    // Helper function to emit user status change
    const emitUserStatusChange = async (userId, isOnline) => {
      try {
        // Get all rooms this user is a member of
        const pool = await import("./config/database.js").then((m) => m.default);
        const roomsResult = await pool.query(
          `SELECT "roomId" FROM chatroomusers WHERE "userId" = $1`,
          [userId]
        );

        const roomIds = roomsResult.rows.map((row) => row.roomId);

        // Emit user status change to all these rooms
        roomIds.forEach((roomId) => {
          io.emit("user_status_change", {
            userId,
            isOnline,
          });
        });
      } catch (error) {
        console.error("Error emitting user status change:", error);
      }
    };
  });
};

export default setupSocketIO; 