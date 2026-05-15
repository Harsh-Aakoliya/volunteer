# Sevak Backend

Real-time chat backend powering the Sevak volunteer management application. Built with Express, PostgreSQL, Socket.IO, and Firebase Cloud Messaging.

## Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js** (ES Modules) | Runtime |
| **Express 4** | HTTP API framework |
| **PostgreSQL** (via `pg`) | Primary database |
| **Redis** | Caching & rate-limiting |
| **Socket.IO 4** | Real-time messaging & video call signaling |
| **Firebase Admin** | Push notifications (FCM) |
| **JWT** | Authentication tokens |
| **Multer + Sharp + FFmpeg** | Media upload & processing |
| **Joi** | Request validation |
| **Twilio** | SMS / OTP |
| **Docker** | Containerised deployment |

## Project Structure

```
Backend/
├── config/
│   ├── database.js          # PostgreSQL connection pool
│   ├── firebase.js           # Firebase Admin SDK init
│   └── redis.js              # Redis client singleton
├── controllers/
│   ├── authController.js     # Login, OTP, JWT
│   ├── chatController.js     # Messages, rooms, media
│   ├── chatNotificationController.js
│   ├── monitoringController.js
│   ├── notificationController.js
│   ├── otaController.js      # OTA update manifests & assets
│   ├── pollController.js     # In-chat polls
│   ├── userController.js     # User CRUD
│   ├── versionController.js  # APK version check
│   └── vmMediaController.js  # Voice message media
├── middlewares/
│   ├── auth.js               # JWT authentication
│   ├── errorHandler.js       # Centralised error handler
│   └── inputValidator.js     # Joi validation middleware
├── models/
│   ├── initDB.js             # Schema bootstrap (runs .sql files)
│   ├── SevakMaster.sql
│   ├── DepartmentMaster.sql
│   ├── community.sql
│   ├── chatrooms.sql
│   ├── chatroomusers.sql
│   ├── chatmessages.sql
│   ├── media.sql
│   ├── poll.sql
│   ├── messagereadstatus.sql
│   └── notification_tokens.sql
├── routes/
│   ├── index.js              # Route aggregator
│   ├── authRoutes.js
│   ├── chatRoutes.js
│   ├── userRoutes.js
│   ├── pollRoutes.js
│   ├── vmMediaRoutes.js
│   ├── versionRoutes.js
│   ├── notificationRoutes.js
│   ├── monitoringRoutes.js
│   └── otaRoutes.js
├── services/
│   ├── scheduledMessageService.js
│   └── tokenStore.js
├── socket.js                 # Socket.IO event handlers
├── server.js                 # App entry point
├── version.json              # Published APK + OTA version metadata
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
└── package.json
```

## API Endpoints

### Health & Version

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/test` | Health check — returns `{ message: "API is running" }` |
| `GET` | `/api/version` | Current published APK & OTA versions |

### Auth (`/api/auth`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with credentials |
| `POST` | `/api/auth/send-otp` | Send OTP via Twilio |
| `POST` | `/api/auth/verify-otp` | Verify OTP & issue JWT |

### Chat (`/api/chat`)

Messages, rooms, media uploads, read receipts, scheduled messages.

### Users (`/api/users`)

User profile CRUD, department lookup.

### Polls (`/api/poll`)

Create/vote/results for in-chat polls.

### Notifications (`/api/notifications`)

Register/unregister FCM tokens, send push notifications.

### OTA Updates (`/api/ota`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ota/check` | Lightweight JSON check for OTA availability |
| `GET` | `/api/ota/manifest` | Expo Updates protocol manifest (multipart v1) |
| `GET` | `/api/ota/assets/:apkVersion/:otaVersion/*` | Serve OTA bundle & assets |

### Media

| Method | Path | Description |
|---|---|---|
| `GET` | `/media/*` | Static file serving for uploaded chat media |
| `POST` | `/upload` | Upload audio file |
| `GET` | `/files` | List uploaded audio files |

## Socket.IO Events

### Client -> Server

| Event | Payload | Description |
|---|---|---|
| `identify` | `{ userId }` | Bind socket to user |
| `userOnline` | `{ userId }` | Mark user online |
| `userOffline` | `{ userId }` | Mark user offline |
| `requestRoomData` | `{ userId }` | Fetch all rooms, communities, unread counts |
| `joinRoom` | `{ roomId, userId, userName }` | Join a chat room |
| `leaveRoom` | `{ roomId, userId }` | Leave a chat room |
| `sendMessage` | `{ roomId, message, sender }` | Send a chat message |
| `video-call-*` | (various) | WebRTC signaling for video calls |

### Server -> Client

| Event | Payload | Description |
|---|---|---|
| `roomsData` | `{ rooms, communities }` | Full room list with metadata |
| `newMessage` | message object | New message in a room |
| `roomUpdate` | `{ roomId, lastMessage, unreadCount }` | Room list update |
| `onlineUsers` | `{ roomId, onlineUsers, onlineCount }` | Online status |
| `video-call-*` | (various) | WebRTC signaling responses |

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 7
- Firebase service account key (`serviceAccountKey.json`)

### Local Development

```bash
cd Backend

# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env

# Start dev server (uses nodemon)
npm start
```

The server starts on port **8080** by default.

### Docker

```bash
cd Backend

# Build and start all services (app + postgres + redis)
docker compose up --build

# Or run in background
docker compose up --build -d

# View logs
docker compose logs -f app

# Stop everything
docker compose down

# Stop and remove volumes (wipes DB data)
docker compose down -v
```

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `PGUSER` | PostgreSQL user | `postgres` |
| `PGHOST` | PostgreSQL host | `localhost` |
| `PGDATABASE` | PostgreSQL database name | `volunteer` |
| `PGPASSWORD` | PostgreSQL password | `password` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `JWT_SECRET` | Secret for signing JWTs | `my-secret-key` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | |
| `TWILIO_PHONE_NUMBER` | Twilio sender number | |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```
