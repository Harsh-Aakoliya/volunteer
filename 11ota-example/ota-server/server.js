require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('./src/config');
const database = require('./src/database');
const errorHandler = require('./src/middleware/errorHandler');

// Routes
const authRoutes = require('./src/routes/auth.routes');
const appRoutes = require('./src/routes/app.routes');
const releaseRoutes = require('./src/routes/release.routes');
const expoRoutes = require('./src/routes/expo.routes');

const app = express();

// Ensure directories
[config.storagePath, path.dirname(config.dbPath), './logs'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize DB
database.initialize();

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(morgan('short'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health
app.get('/health', (req, res) => {
  console.log('health check');
  res.json({ status: 'ok', version: '2.0.0', uptime: process.uptime() });
});

// API
app.use('/api/auth', authRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/expo', expoRoutes);           // ← Expo updates protocol

// Error handler
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

const PORT = config.port;
const server = app.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => !item.internal && item.family === "IPv4")
    .map((item) => item.address);

  console.log(`Server running on port ${PORT}`);
  addresses.forEach((addr) => console.log(`http://${addr}:${PORT}`));
});
// app.listen(PORT, config.host, () => {
//   console.log(`
//   ╔═══════════════════════════════════════════════════╗
//   ║         🚀 OTA Server for Expo Running            ║
//   ║                                                   ║
//   ║   URL:  http://${config.host}:${PORT}                      ║
//   ║   ENV:  ${config.nodeEnv}                              ║
//   ║                                                   ║
//   ║   Expo Manifest: GET /api/expo/manifest            ║
//   ║   Upload:        POST /api/releases/expo-upload    ║
//   ║   Auth:          POST /api/auth/register           ║
//   ║                                                   ║
//   ╚═══════════════════════════════════════════════════╝
//   `);
// });

module.exports = app;