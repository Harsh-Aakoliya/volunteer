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
import errorHandling from "./middlewares/errorHandler.js";
import apiRoutes from "./routes/index.js";
import setupSocketIO from "./socket.js";
import os from "os";
import path from "path";
import fs from "fs";
import { dirname } from 'path';

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

//checking 
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running" });
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
