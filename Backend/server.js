// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
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
import multer from "multer";

//visit http://localhost:8080/#/ for socket.io admin ui
dotenv.config();
const PORT =8080;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors:{
    origin:["http://localhost:8080","http://localhost:8081"],
    credentials:true
  }
});

instrument(io, {
  auth: false,
  mode: "development",
});

// Increase payload limits for file uploads (Base64 encoded files can be large)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('./node_modules/@socket.io/admin-ui/ui/dist'))
app.use(
  cors({
    origin: ["https://admin.socket.io","http://localhost:8081"],
    credentials: true,
  })
);
app.use(errorHandling);
app.use("/media",express.static(path.join(process.cwd(), 'media')));


/** demo start */
// Serve uploaded files statically 
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `audio_${timestamp}.m4a`);
  }
});

const upload = multer({ storage });

// Upload audio file
app.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Always use the actual server IP, not request host
  const fileUrl = `${BASE_URL}/uploads/${req.file.filename}`;

  console.log('✅ File uploaded:', req.file.filename);
  console.log('   URL:', fileUrl);

  res.json({
    success: true,
    filename: req.file.filename,
    url: fileUrl,
    size: req.file.size
  });
});

// Get all audio files
app.get('/files', (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');

  if (!fs.existsSync(uploadsDir)) {
    return res.json({ files: [] });
  }

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read files' });
    }

    // Always use the actual server IP, not request host
    const audioFiles = files
      .filter(file => file.startsWith('audio_') && file.endsWith('.m4a'))
      .map(file => ({
        filename: file,
        url: `${BASE_URL}/uploads/${file}`,
        createdAt: new Date(parseInt(file.split('_')[1])).toISOString()
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ files: audioFiles });
  });
});
/**demo end */

// Initialize database - single function creates all tables in correct order
// initDB().catch(error => {
//   console.error("Failed to initialize database:", error);
//   process.exit(1);
// });

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
setupSocketIO(io, app);

// API routes
app.use('/api', apiRoutes);

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
