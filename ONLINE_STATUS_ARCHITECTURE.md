# Global Online Status Architecture

## Overview
The online status system has been completely re-architected to work globally across all rooms, independent of which specific room a user is viewing.

## Core Concept
- **Global Tracking**: User online status is tracked globally in `globalOnlineUsers` Set
- **Independent of Room**: Being online is NOT tied to being in a specific room
- **Broadcast to All**: Status changes broadcast to ALL connected clients, not just room members

## Backend Architecture

### Data Structures
```javascript
const globalOnlineUsers = new Set();  // Set of online userIds
const socketToUser = new Map();       // socketId -> user info
const userToSockets = new Map();      // userId -> Set of socketIds
```

### Key Helper Functions

#### 1. `getOnlineCountForRoom(roomId)`
- Gets all members of a room
- Filters by who is in `globalOnlineUsers`
- Returns: `{ onlineCount, totalMembers, onlineUsers }`

#### 2. `broadcastRoomOnlineCount(roomId)`
- Calculates online count for room
- Emits `onlineUsers` event to **ALL clients** (not just room members)
- Event includes: `{ roomId, onlineUsers, onlineCount, totalMembers }`

#### 3. `updateRoomMembersStatus(roomId, io)`
- Gets room members with online status
- Emits `roomMembers` event to clients in that specific room
- Used for Members tab real-time updates

### Socket Event Handlers

#### `userOnline`
**Trigger**: User opens app + logged in
```javascript
1. Add userId to globalOnlineUsers
2. Get all rooms user is part of
3. Emit "userOnlineStatusUpdate" to ALL clients globally
4. For each room:
   - broadcastRoomOnlineCount(roomId)  // To ALL clients
   - updateRoomMembersStatus(roomId)   // To room members
```

#### `userOffline`
**Trigger**: User closes app, logs out, or goes to background
```javascript
1. Remove userId from globalOnlineUsers
2. Get all rooms user is part of
3. Emit "userOnlineStatusUpdate" to ALL clients globally
4. For each room:
   - broadcastRoomOnlineCount(roomId)  // To ALL clients
   - updateRoomMembersStatus(roomId)   // To room members
```

#### `joinRoom`
**Trigger**: User navigates to a specific room
```javascript
1. Join socket room for targeted messages
2. Clear unread count for this room
3. broadcastRoomOnlineCount(roomId)   // Show current online count
4. updateRoomMembersStatus(roomId)    // Send member list
```

#### `leaveRoom`
**Trigger**: User navigates away from a room
```javascript
1. Leave socket room
2. Update user's currentRooms list
// NOTE: Does NOT change global online status
```

#### `disconnect`
**Trigger**: Socket disconnects (network loss, app killed)
```javascript
1. Check if user has other connected sockets
2. If no other sockets:
   - Remove from globalOnlineUsers
   - Emit "userOnlineStatusUpdate" globally
   - Broadcast updated counts for all user's rooms
```

#### `requestRoomData`
**Trigger**: User opens chat list (app/(drawer)/index.tsx)
```javascript
1. Send last messages for user's rooms
2. Send unread counts
3. For EACH room user is part of:
   - Calculate and send current onlineCount
```

## Frontend Architecture

### Chat List (app/(drawer)/index.tsx)

**State**:
```typescript
const [chatRooms, setChatRooms] = useState<ExtendedChatRoom[]>([]);
// ExtendedChatRoom includes onlineCount property
```

**Socket Listeners**:
```typescript
socket.on("onlineUsers", (data) => {
  // Updates onlineCount for the specific room
  // Shows as green badge with number on room avatar
  setChatRooms(prevRooms => 
    prevRooms.map(room => 
      room.roomId === data.roomId 
        ? { ...room, onlineCount: data.onlineCount }
        : room
    )
  );
});
```

**Result**: Green badge updates immediately when anyone goes online/offline

### Room Screen (app/chat/[roomId].tsx)

**State**:
```typescript
const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
const [roomMembers, setRoomMembers] = useState<ChatUser[]>([]);
```

**Socket Listeners**:
```typescript
socketService.onOnlineUsers(({ roomId, onlineUsers }) => {
  if (roomId === currentRoomId) {
    setOnlineUsers(onlineUsers);  // Updates "X/Y online" in header
  }
});
```

**Result**: Header shows "X/Y online" and updates immediately

### Room Info - Members Tab (components/chat/roomSettings/MembersTab.tsx)

**State**:
```typescript
const [members, setMembers] = useState<Member[]>([]);
// Member includes isOnline property
```

**Socket Listeners**:
```typescript
socket.on("userOnlineStatusUpdate", ({ userId, isOnline }) => {
  // Updates specific member's online status
  setMembers(prevMembers =>
    prevMembers.map(member =>
      member.userId === userId 
        ? { ...member, isOnline }
        : member
    )
  );
});

socket.on("roomMembers", ({ roomId, members }) => {
  // Updates entire member list with online status
  setMembers(members);
});
```

**Result**: Red/green dots update immediately

## Complete Flow Examples

### Scenario 1: User Opens App (Logged In)

**User Action**: u1 opens app

**Backend Flow**:
1. AppState detects foreground → calls `socketService.setUserOnline(u1)`
2. Backend receives `userOnline` event
3. Backend adds u1 to `globalOnlineUsers`
4. Backend queries: u1 is in rooms [r1, r2, r3]
5. Backend emits to ALL clients:
   ```javascript
   io.emit("userOnlineStatusUpdate", { userId: "u1", isOnline: true })
   ```
6. For each room (r1, r2, r3):
   ```javascript
   io.emit("onlineUsers", {
     roomId: "r1",
     onlineCount: 5,  // calculated from globalOnlineUsers
     totalMembers: 10,
     onlineUsers: ["u1", "u2", "u3", "u4", "u5"]
   })
   ```

**Frontend Updates** (Immediate):
- **u2 on chat list**: Sees r1 badge change from "4" → "5"
- **u3 in room r1**: Sees header change from "4/10 online" → "5/10 online"
- **u4 in room-info Members tab**: Sees u1's dot change from red → green

### Scenario 2: User Closes App

**User Action**: u1 closes app

**Backend Flow**:
1. AppState detects background → calls `socketService.setUserOffline(u1)`
2. Backend receives `userOffline` event
3. Backend removes u1 from `globalOnlineUsers`
4. Backend queries: u1 was in rooms [r1, r2, r3]
5. Backend emits to ALL clients:
   ```javascript
   io.emit("userOnlineStatusUpdate", { userId: "u1", isOnline: false })
   ```
6. For each room (r1, r2, r3):
   ```javascript
   io.emit("onlineUsers", {
     roomId: "r1",
     onlineCount: 4,  // u1 removed
     totalMembers: 10,
     onlineUsers: ["u2", "u3", "u4", "u5"]
   })
   ```

**Frontend Updates** (Immediate):
- **u2 on chat list**: Sees r1 badge change from "5" → "4"
- **u3 in room r1**: Sees header change from "5/10 online" → "4/10 online"
- **u4 in room-info Members tab**: Sees u1's dot change from green → red

### Scenario 3: User Logs Out

**User Action**: u1 clicks logout

**Frontend Flow**:
1. `logout()` function calls `socketService.setUserOffline(u1)`
2. Waits 500ms for broadcast
3. Disconnects socket
4. Clears storage

**Backend Flow**: Same as Scenario 2

**Result**: u1 appears offline even before logout completes

### Scenario 4: Network Disconnect

**User Action**: u1's network drops or app is killed

**Backend Flow**:
1. Socket disconnect event fires
2. Backend checks: does u1 have other connected sockets? No
3. Backend removes u1 from `globalOnlineUsers`
4. Backend broadcasts offline status globally
5. Updates all of u1's rooms

**Result**: All users see u1 go offline within 1-2 seconds

## Key Differences from Old Architecture

### Old (Room-Based)
- ❌ Online status tied to viewing specific room
- ❌ Tracked in `onlineUsersByRoom[roomId]`
- ❌ Only updated when user joined/left room
- ❌ Didn't update when user closed app
- ❌ Inconsistent across different rooms

### New (Global)
- ✅ Online status is truly global
- ✅ Tracked in single `globalOnlineUsers` Set
- ✅ Updates on app foreground/background
- ✅ Updates on login/logout
- ✅ Consistent everywhere simultaneously
- ✅ Broadcasts to ALL clients, not just room members

## Testing Checklist

### Test 1: App Open/Close
- [ ] User u1 opens app → All users see u1 online immediately
- [ ] User u1 closes app → All users see u1 offline immediately
- [ ] Check: Chat list badge updates
- [ ] Check: Room header "X/Y online" updates
- [ ] Check: Members tab dots update

### Test 2: Login/Logout
- [ ] User u1 logs in → All users see u1 online
- [ ] User u1 logs out → All users see u1 offline (even before logout finishes)
- [ ] Check: Online status clears across all rooms

### Test 3: Network Disconnect
- [ ] User u1 loses network → All users see u1 offline within 2 seconds
- [ ] User u1 regains network + app opens → All users see u1 online

### Test 4: Multiple Rooms
- [ ] User u1 is in rooms r1, r2, r3
- [ ] User u1 goes online → ALL three rooms show updated count
- [ ] User u2 viewing r1, u3 viewing r2, u4 viewing r3
- [ ] All see u1's status change simultaneously

### Test 5: Room Navigation
- [ ] User u1 is online globally
- [ ] User u1 navigates from r1 to r2
- [ ] Check: u1 stays online in both rooms
- [ ] Check: Other users don't see u1 go offline/online during navigation

### Test 6: App Background/Foreground
- [ ] User u1 minimizes app → Goes offline
- [ ] User u1 returns to app → Goes online
- [ ] Check: Status updates across all screens immediately

## Performance Considerations

### Scalability
- `globalOnlineUsers` is a Set → O(1) lookups
- Room online count calculated on-demand → No stale data
- Broadcasts use Socket.IO rooms → Efficient targeting

### Network Efficiency
- Events only sent when status actually changes
- No polling required
- Socket.IO handles reconnection automatically

### Memory Usage
- Single Set for all online users
- No per-room duplication
- Automatic cleanup on disconnect

## Troubleshooting

### Issue: Online count not updating

**Check**:
1. Is socket connected? `socketService.socket?.connected`
2. Is user in `globalOnlineUsers`? (Backend console)
3. Are events being broadcast? (Backend console shows "📢 Broadcasting...")
4. Is frontend listening? (Check socket.on("onlineUsers") is registered)

### Issue: User shows online after logout

**Check**:
1. Is `setUserOffline` being called before logout?
2. Is socket staying connected after logout?
3. Are there multiple devices/sockets for this user?

### Issue: Inconsistent status across rooms

**Check**:
1. Verify backend is using `globalOnlineUsers` not `onlineUsersByRoom`
2. Verify broadcast uses `io.emit()` not `io.to(room).emit()`
3. Check backend logs for "Broadcasting to ALL users"

## Conclusion

The new architecture ensures that online status is:
- **Global**: One source of truth
- **Immediate**: Sub-second updates
- **Consistent**: Same everywhere
- **Reliable**: Handles all edge cases
- **Scalable**: Efficient for any number of users/rooms

