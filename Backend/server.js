// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import initDB from "./models/User.js";
import initChatDB from "./models/Chat.js";
import initPollDB from "./models/Poll.js";
import initMediaDB from "./models/Media.js";
import initTableDB from "./models/Table.js";
import initDepartmentDB from "./models/Department.js"; 
import initializeForeignKeyConstraints from "./models/ForeignKeyConstraints.js"
import errorHandling from "./middlewares/errorHandler.js";
import apiRoutes from "./routes/index.js";
import setupSocketIO from "./socket.js";
import os from "os";
import path from "path";
import fs from "fs";
import { dirname } from 'path';

dotenv.config();
const PORT =3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this to your app's domain
    methods: ["GET", "POST"],
  },
});

// Increase payload limits for file uploads (Base64 encoded files can be large)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(errorHandling);
app.use("/media",express.static(path.join(process.cwd(), 'media')));

// Initialize database
initDB();
initChatDB();
initPollDB();
initMediaDB();
initTableDB();
initDepartmentDB();
initializeForeignKeyConstraints();

const UPLOAD_DIR = path.join(process.cwd(), 'media');
console.log("UPLOAD_DIR",UPLOAD_DIR);
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Upload directory created: ${UPLOAD_DIR}`);
}

// Make io available to routes
app.set('io', io);

// Store online users by room
const onlineUsersByRoom = {};
app.set('onlineUsersByRoom', onlineUsersByRoom);

// Store unread messages by user and room
const unreadMessagesByUser = {};
app.set('unreadMessagesByUser', unreadMessagesByUser);

// Store last message by room
const lastMessageByRoom = {};
app.set('lastMessageByRoom', lastMessageByRoom);

// API routes
app.use('/api', apiRoutes);

// Set up Socket.IO
setupSocketIO(io, app);
// Add this to your server.js file, after the existing routes but before the test endpoint

// API endpoint to list media files
app.get("/media", (req, res) => {
  try {
    const mediaDir = path.join(process.cwd(), 'media');
    
    // Check if media directory exists
    if (!fs.existsSync(mediaDir)) {
      return res.json([]);
    }

    // Read all files in the media directory
    const files = fs.readdirSync(mediaDir);
    
    // Filter out only media files (optional - you can remove this filter if you want all files)
    const mediaFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', // Images
        '.mp4', '.mov', '.avi', '.mkv', '.webm', // Videos
        '.mp3', '.wav', '.aac', '.m4a', '.ogg' // Audio
      ].includes(ext);
    });

    console.log('Media files found:', mediaFiles);
    res.json(mediaFiles);
  } catch (error) {
    console.error('Error reading media directory:', error);
    res.status(500).json({ error: 'Unable to read media directory' });
  }
});

// Alternative endpoint with more detailed file information (optional)
app.get("/api/media", (req, res) => {
  try {
    const mediaDir = path.join(process.cwd(), 'media');
    
    if (!fs.existsSync(mediaDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(mediaDir);
    
    const mediaFiles = files.map(file => {
      const filePath = path.join(mediaDir, file);
      const stats = fs.statSync(filePath);
      const ext = path.extname(file).toLowerCase();
      
      let type = 'other';
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
        type = 'image';
      } else if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
        type = 'video';
      } else if (['.mp3', '.wav', '.aac', '.m4a', '.ogg'].includes(ext)) {
        type = 'audio';
      }

      return {
        name: file,
        type: type,
        size: stats.size,
        modified: stats.mtime
      };
    });

    res.json(mediaFiles);
  } catch (error) {
    console.error('Error reading media directory:', error);
    res.status(500).json({ error: 'Unable to read media directory' });
  }
});
//checking 
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running" });
});

// Version endpoint
app.get("/api/version", (req, res) => {
  try {
    const versionPath = path.join(process.cwd(), 'version.json');
    if (fs.existsSync(versionPath)) {
      const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      res.json(versionData);
    } else {
      res.status(404).json({ error: 'Version file not found' });
    }
  } catch (error) {
    console.error('Error reading version file:', error);
    res.status(500).json({ error: 'Unable to read version file' });
  }
});

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
