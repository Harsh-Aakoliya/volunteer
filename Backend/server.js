// Update your server.js to include socket.io and chat routes
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pool from './config/datebase.js';
import authController from './controllers/authController.js';
import userController from './controllers/userController.js';
import chatController from './controllers/chatController.js';
import initDB from './models/User.js';
import initChatDB from './models/Chat.js';
import os from 'os';
import errorHandling from './middlewares/errorHandler.js';
import { createAnnouncement, getAnnouncements, updateLikes, deleteAnnouncement } from './controllers/announcementController.js';
import chatRoutes from './routes/chatRoutes.js';

dotenv.config();
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this to your app's domain
    methods: ["GET", "POST"]
  }
});

app.use(express.json());  
app.use(cors());

app.use(errorHandling);

// Initialize database
initDB();
initChatDB();

// Auth routes
app.post('/api/register', authController.register);
app.post('/api/login', authController.login);

// User profile routes
app.get('/api/pending-users', userController.getPendingUsers);
app.post('/api/approve-user', userController.approveUser);
app.get('/api/users/:userId/profile', userController.getUserProfile);
app.get('/api/users/:userId/attendance', userController.getUserAttendance);
app.put('/api/users/:userId/profile', userController.updateUserProfile);

// Announcement routes
app.post('/api/announcements', createAnnouncement);
app.get('/api/announcements', getAnnouncements);
app.post('/api/announcements/likes', updateLikes);
app.delete("/api/announcement/:id", deleteAnnouncement);


//chat routes
app.use('/api/chat', chatRoutes);

app.listen(PORT, '0.0.0.0', () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(item => !item.internal && item.family === 'IPv4')
    .map(item => item.address);

  console.log(`Server running on port ${PORT}`);
  console.log('Available on:');
  addresses.forEach(addr => console.log(`http://${addr}:${PORT}`));
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
