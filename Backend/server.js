// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import initDB from "./models/initDB.js";
import { initializeFirebase } from "./config/firebase.js";
import errorHandling from "./middlewares/errorHandler.js";
import apiRoutes from "./routes/index.js";
import setupSocketIO from "./socket.js";
// import scheduledPublisher from "./services/scheduledAnnouncementPublisher.js";
import scheduledMessageService from "./services/scheduledMessageService.js";
import os from "os";
import path from "path";
import fs from "fs";
import { dirname } from 'path';

dotenv.config();
const PORT =8080;

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

// Initialize database - single function creates all tables in correct order
initDB().catch(error => {
  console.error("Failed to initialize database:", error);
  process.exit(1);
});

// Initialize Firebase for FCM notifications
initializeFirebase();

// Initialize scheduled announcement publisher
console.log('🚀 Starting scheduled announcement publisher...');

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

// Set up Socket.IO
// setupSocketIO(io, app);

// API routes
app.use('/api', apiRoutes);

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

// Version endpoint
app.get("/api/version", (req, res) => {
  console.log("version checking req got");
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

// Scheduled announcement publisher endpoints
app.get("/api/scheduled-publisher/status", (req, res) => {
  try {
    const status = scheduledPublisher.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error getting publisher status:', error);
    res.status(500).json({ error: 'Unable to get publisher status' });
  }
});

app.post("/api/scheduled-publisher/check", async (req, res) => {
  try {
    await scheduledPublisher.manualCheck();
    res.json({ success: true, message: 'Manual check completed' });
  } catch (error) {
    console.error('Error during manual check:', error);
    res.status(500).json({ error: 'Manual check failed' });
  }
});

// Scheduled message service endpoints
app.get("/api/scheduled-messages/status", (req, res) => {
  try {
    const status = scheduledMessageService.isRunning;
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error getting scheduled message service status:', error);
    res.status(500).json({ error: 'Unable to get service status' });
  }
});

app.post("/api/scheduled-messages/check", async (req, res) => {
  try {
    await scheduledMessageService.triggerCheck();
    res.json({ success: true, message: 'Manual check completed' });
  } catch (error) {
    console.error('Error during manual check:', error);
    res.status(500).json({ error: 'Manual check failed' });
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
  
  // Start scheduled message service
  // scheduledMessageService.start();
});




