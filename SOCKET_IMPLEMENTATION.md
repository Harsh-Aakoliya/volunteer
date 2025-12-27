# Socket.IO Chat Implementation

This document explains the complete socket-based real-time chat implementation for the Sevak App.

## Architecture Overview

The socket system follows a **singleton pattern** with **React Context** for state management:

```
┌─────────────────────────────────────────────────────────────┐
│                      App (_layout.tsx)                       │
│                            │                                 │
│                    ┌───────┴───────┐                        │
│                    │ SocketProvider │                        │
│                    └───────┬───────┘                        │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│    Chat Rooms         Chat Room         Room Info           │
│    (index.tsx)      ([roomId].tsx)   (room-info.tsx)       │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                 │
│                    ┌───────┴───────┐                        │
│                    │ SocketManager │  (Singleton)           │
│                    └───────┬───────┘                        │
│                            │                                 │
│                    ┌───────┴───────┐                        │
│                    │   Socket.IO    │                        │
│                    └───────┬───────┘                        │
│                            │                                 │
└────────────────────────────┼────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  Backend Server  │
                    │   (socket.js)    │
                    └─────────────────┘
```

## File Structure

### Client-Side

| File | Purpose |
|------|---------|
| `utils/socketManager.ts` | Singleton class managing socket connection, events, subscriptions |
| `contexts/SocketContext.tsx` | React Context providing socket state to components |
| `app/(drawer)/index.tsx` | Chat rooms list with real-time updates |
| `app/chat/[roomId].tsx` | Individual chat room with messages |
| `app/chat/room-info.tsx` | Room settings with member online status |
| `components/chat/roomSettings/MembersTab.tsx` | Members list with online status |

### Server-Side

| File | Purpose |
|------|---------|
| `Backend/socket.js` | Socket.IO server handling all events |

## Socket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `identify` | `{ userId }` | Identify connected user |
| `userOnline` | `{ userId }` | Mark user as online |
| `userOffline` | `{ userId }` | Mark user as offline |
| `requestRoomData` | `{ userId }` | Request room data (throttled) |
| `joinRoom` | `{ roomId, userId, userName }` | Join a chat room |
| `leaveRoom` | `{ roomId, userId }` | Leave a chat room |
| `getRoomOnlineUsers` | `{ roomId }` | Get online users in a room |
| `sendMessage` | `{ roomId, message, sender }` | Send a message |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `lastMessage` | `{ lastMessageByRoom }` | Last messages for user's rooms |
| `unreadCounts` | `{ unreadCounts }` | Unread counts per room |
| `roomUpdate` | `{ roomId, lastMessage?, unreadCount? }` | Room update notification |
| `newMessage` | Message object | New message in current room |
| `messageEdited` | `{ roomId, messageId, ... }` | Message was edited |
| `messagesDeleted` | `{ roomId, messageIds }` | Messages were deleted |
| `onlineUsers` | `{ roomId, users, count }` | Online users in a room |
| `roomMembers` | `{ roomId, members }` | Room members with status |
| `userOnlineStatusUpdate` | `{ userId, isOnline }` | User status changed |
| `roomOnlineUsers` | `{ roomId, onlineUsers }` | Response to getRoomOnlineUsers |

## Key Features

### 1. Single Connection

The `SocketManager` singleton ensures only one socket connection exists per app instance:

```typescript
// Get the singleton instance
const socketManager = SocketManager.getInstance();

// Connect with user info
await socketManager.connect({ id: userId, name: userName });
```

### 2. Subscription System

Components subscribe to events using a simple API:

```typescript
// Subscribe
const id = socketManager.on('newMessage', (message) => {
  console.log('New message:', message);
});

// Unsubscribe
socketManager.off(id);
```

### 3. Throttling

The `requestRoomData` event is throttled to prevent excessive requests:
- Client-side: 2-second minimum between requests
- Server-side: 2-second minimum per user

### 4. App State Handling

The system automatically handles app foreground/background transitions:
- **Foreground**: User marked online, data refreshed
- **Background**: User marked offline

### 5. Room Management

Rooms are automatically managed:
- Joining a room clears unread count
- Leaving a room updates the server
- Only one room can be active at a time

## Usage Examples

### Chat Rooms List

```tsx
import { useSocket, useRoomListSubscription } from '@/contexts/SocketContext';

function ChatRoomsList() {
  const { isConnected, lastMessages, unreadCounts, refreshRoomData } = useSocket();

  // Subscribe to room updates
  useRoomListSubscription({
    onRoomUpdate: (data) => {
      // Handle room update
    },
    onOnlineUsers: (data) => {
      // Handle online users change
    },
  });

  // Refresh data
  useEffect(() => {
    if (isConnected) {
      refreshRoomData();
    }
  }, [isConnected]);
}
```

### Chat Room

```tsx
import { useSocket, useChatRoomSubscription } from '@/contexts/SocketContext';

function ChatRoom({ roomId }) {
  const { sendMessage } = useSocket();

  // Subscribe to room events (auto-joins/leaves room)
  useChatRoomSubscription({
    roomId,
    onNewMessage: (message) => {
      // Add message to list
    },
    onMessageEdited: (data) => {
      // Update message
    },
    onMessagesDeleted: (data) => {
      // Remove messages
    },
    onOnlineUsers: (data) => {
      // Update online count
    },
  });

  // Send a message
  const handleSend = () => {
    sendMessage(roomId, {
      messageText: 'Hello!',
      messageType: 'text',
      createdAt: new Date().toISOString(),
    });
  };
}
```

## Server Data Stores

The backend maintains these in-memory stores:

| Store | Type | Description |
|-------|------|-------------|
| `socketUsers` | `Map<socketId, userData>` | Maps socket IDs to user data |
| `userSockets` | `Map<userId, Set<socketId>>` | Maps users to their socket(s) |
| `onlineUsers` | `Set<userId>` | Currently online users |
| `lastMessages` | `Map<roomId, message>` | Last message per room |
| `unreadCounts` | `Map<userId, Map<roomId, count>>` | Unread counts per user per room |

## Global Functions

The backend exposes global functions for use in API controllers:

```javascript
// Update last message (call after sending message via API)
global.updateLastMessage(roomId, message);

// Increment unread count
global.incrementUnreadCount(userId, roomId);

// Clear unread count
global.clearUnreadCount(userId, roomId);

// Emit to all sockets in a room
global.emitToRoom(roomId, 'eventName', data);

// Emit to specific user
global.emitToUser(userId, 'eventName', data);
```

## Troubleshooting

### Messages Not Appearing

1. Check socket connection: `socketManager.isConnected()`
2. Verify user is in the room: `socketManager.getCurrentRoom()`
3. Check console for error logs

### Duplicate Messages

Messages are deduplicated by ID in the chat room component using a `Set`.

### Online Status Not Updating

1. Ensure `userOnline` event is sent after connection
2. Check that `broadcastUserStatus` is working on backend
3. Verify app state listener is active (non-web only)

### Infinite Re-renders

The implementation uses:
- Stable `useCallback` references
- Functional state updates
- Throttling on data requests
- `useRef` for flags instead of state

## Performance Optimizations

1. **Memoized Components**: `RoomItem`, `MemberItem` use `React.memo`
2. **FlatList Optimizations**: `removeClippedSubviews`, `windowSize`, `maxToRenderPerBatch`
3. **Throttled Requests**: Prevent excessive API calls
4. **Lazy Subscriptions**: Subscribe only when connected
5. **Efficient Updates**: Functional state updates avoid closures

