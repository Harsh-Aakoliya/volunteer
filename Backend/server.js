// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import authController from "./controllers/authController.js";
import userController from "./controllers/userController.js";
import initDB from "./models/User.js";
import initChatDB from "./models/Chat.js";
import os from "os";
import errorHandling from "./middlewares/errorHandler.js";
import {
  createAnnouncement,
  getAnnouncements,
  updateLikes,
  deleteAnnouncement,
  updateAnnouncementController,
} from "./controllers/announcementController.js";
import chatRoutes from "./routes/chatRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

dotenv.config();
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this to your app's domain
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(cors());
app.use(errorHandling);

// Initialize database
initDB();
initChatDB();

// Store online users by room
const onlineUsersByRoom = {};

// Store unread messages by user and room
const unreadMessagesByUser = {};

// Store last message by room
const lastMessageByRoom = {};

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  let currentUser = null;
  let currentRooms = [];

  // Handle user joining a chat room
  socket.on("joinRoom", async ({ roomId, userId, userName }) => {
    console.log("unread messages by user", unreadMessagesByUser);
    try {
      if (!roomId || !userId) {
        console.error("Invalid joinRoom parameters:", {
          roomId,
          userId,
          userName,
        });
        return;
      }

      // Collapse
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
      const pool = await import("./config/datebase.js").then((m) => m.default);
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

      // Collapse
      // Remove user from online users for this room
      if (onlineUsersByRoom[roomId]) {
        onlineUsersByRoom[roomId].delete(userId);

        // If room is empty, clean up
        if (onlineUsersByRoom[roomId].size === 0) {
          delete onlineUsersByRoom[roomId];
        } else {
          try {
            // Get all members for this room from the database
            const pool = await import("./config/datebase.js").then(
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
        `New message in room ${roomId} from ${sender.userName}:, message.messageText`
      );

      // Collapse
      // Store as last message for this room
      lastMessageByRoom[roomId] = {
        ...message,
        sender,
      };

      // Get all members of the room
      const pool = await import("./config/datebase.js").then((m) => m.default);
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

    // Collapse
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
              const pool = await import("./config/datebase.js").then(
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
      const pool = await import("./config/datebase.js").then((m) => m.default);
      const roomsResult = await pool.query(
        `
  SELECT "roomId" FROM chatroomusers WHERE "userId" = $1`,
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


//checking 
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running" });
});
// Make variables available to routes
app.set("onlineUsersByRoom", onlineUsersByRoom);
app.set("unreadMessagesByUser", unreadMessagesByUser);
app.set("lastMessageByRoom", lastMessageByRoom);
app.set("io", io); // Make io available to routes

// Auth routes
app.post("/api/register", authController.register);
app.post("/api/login", authController.login);
app.post("/api/check-user", authController.checkUser);

// User profile routes
app.get("/api/pending-users", userController.getPendingUsers);
app.post("/api/approve-user", userController.approveUser);
app.get("/api/users/:userId/profile", userController.getUserProfile);
app.put("/api/users/:userId/profile", userController.updateUserProfile);

// Announcement routes
app.post("/api/announcements", createAnnouncement);
app.get("/api/announcements", getAnnouncements);
app.post("/api/announcements/likes", updateLikes);
app.delete("/api/announcement/:id", deleteAnnouncement);
app.put("/api/announcements/:id", updateAnnouncementController);

// Chat routes
app.use("/api/chat", chatRoutes);

//file uploading routes
app.use("/api/upload", uploadRoutes);

// Use httpServer instead of app to listen
httpServer.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => !item.internal && item.family === "IPv4")
    .map((item) => item.address);

  console.log(`Server running on port ${PORT}`);
  console.log("Available on:");
  addresses.forEach((addr) => console.log(`http://${addr}:${PORT}`));
});

// const admin = require('firebase-admin');
// import express from 'express';
// import cors from 'cors';
// import { Expo } from 'expo-server-sdk';
// import os from 'os';

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Create a new Expo SDK client
// const expo = new Expo();

// app.post('/trigger-notification', async (req, res) => {
//   try {
//     // Extract the Expo push token from the request
//     const { token } = req.body;
//     console.log("Received token:", token);

//     // Check that the token is a valid Expo push token
//     if (!Expo.isExpoPushToken(token)) {
//       res.status(400).json({
//         success: false,
//         error: 'Invalid Expo push token'
//       });
//       return;
//     }

//     // Construct the message
//     const messages = [{
//       to: token,
//       sound: 'default',
//       title: 'Button Pressed!',
//       body: 'The button on the app has been pressed.',
//       data: { withSome: 'data' }
//     }];

//     // Send the messages
//     const chunks = expo.chunkPushNotifications(messages);
//     const tickets = [];

//     // Send each chunk
//     for (const chunk of chunks) {
//       try {
//         const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
//         tickets.push(...ticketChunk);
//       } catch (error) {
//         console.error('Error sending chunk:', error);
//       }
//     }

//     // Check the tickets for errors
//     const receiptIds = [];
//     for (const ticket of tickets) {
//       // NOTE: Not all tickets may be successful
//       if (ticket.id) {
//         receiptIds.push(ticket.id);
//       }
//     }

//     // Optionally, later check the receipts
//     // const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

//     console.log('Notification sent successfully');
//     res.status(200).json({
//       success: true,
//       message: 'Notification sent',
//       tickets
//     });

//   } catch (error) {
//     console.error('Error sending notification:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });
