# App Structure Documentation

## Overview
The Sevak App is now a single-page application with drawer navigation, focusing on chat functionality.

## Folder Structure

```
app/
├── _layout.tsx                 # Root layout with Stack navigation
├── index.tsx                   # Entry point - handles auth check and redirects
│
├── (drawer)/                   # Main drawer navigation group
│   ├── _layout.tsx            # Drawer layout configuration
│   └── index.tsx              # Main chat rooms list (default screen)
│
├── (auth)/                     # Authentication screens
│   ├── _layout.tsx
│   ├── login.tsx
│   └── signup.tsx
│
├── (admin)/                    # Admin-specific screens
│   └── dashboard.tsx
│
├── chat/                       # Chat-related screens
│   ├── _layout.tsx
│   ├── [roomId].tsx           # Individual chat room
│   ├── create-room.tsx        # Create new chat room
│   ├── create-room-metadata.tsx
│   ├── add-members.tsx        # Add members to room
│   ├── room-settings.tsx      # Room settings
│   ├── index.tsx              # Chat index (if needed)
│   ├── Attechments-grid.tsx  # Attachments UI
│   ├── MediaUploader.tsx      # Media upload
│   ├── Polling.tsx            # Poll creation
│   └── table.tsx              # Table creation
│
├── announcement/              # Announcement screens
│   ├── [id].tsx              # Announcement detail
│   └── chat-announcement.tsx # Announcement from chat
│
└── [Other utility screens]
    ├── create-announcement.tsx
    ├── preview.tsx
    ├── profile.tsx
    ├── user-profile.tsx
    ├── edit-user.tsx
    ├── search-users.tsx
    ├── draft-list.tsx
    └── audio.tsx
```

## Key Changes

### 1. Removed Complex Navigation
- **Removed**: `(main)/(tabs)/` with material top tabs
- **Replaced with**: Simple drawer navigation at `(drawer)/`

### 2. Single Main Screen
- **Main Screen**: `(drawer)/index.tsx` - Chat rooms list
- **Header**: Shows "Sevak App" with hamburger menu
- **Drawer**: Opens from left (swipe or tap hamburger icon)

### 3. Navigation Flow
```
app/index.tsx
    ↓
    ├── Not Authenticated → /(auth)/login
    └── Authenticated → /(drawer)/
                            ↓
                        Chat Rooms List
```

### 4. Header Configuration
- **Title**: "Sevak App"
- **Left**: Hamburger menu icon (opens drawer)
- **Right**: Empty space for balance
- **Swipe**: Left-to-right swipe opens drawer

## Features

### Main Screen (Chat Rooms List)
- ✅ Search chat rooms
- ✅ View last message preview
- ✅ Unread message counts
- ✅ Real-time updates via Socket.IO
- ✅ Pull to refresh
- ✅ FAB button for creating rooms (admin/master only)

### Drawer Menu
- Profile information
- Navigation to various sections
- Logout option

### Chat Functionality
- Individual chat rooms
- Text, media, audio, poll, table, and announcement messages
- Real-time messaging with Socket.IO
- Message reactions and replies
- Admin controls for room management

### Announcements
- Create announcements from chat attachments
- View announcements in chat as special message type
- Rich text editing with media attachments

## User Roles
- **Master**: Full administrative access
- **Admin**: Can create rooms and manage users
- **Sevak**: Regular user (can only view and participate in assigned rooms)

## Authentication
- Login/Signup via `(auth)` group
- Token-based authentication
- Automatic redirect based on auth status

## Best Practices Followed
1. ✅ Expo Router file-based routing
2. ✅ Route groups for logical separation
3. ✅ Drawer navigation for main app
4. ✅ Stack navigation for nested screens
5. ✅ Clean folder structure
6. ✅ TypeScript for type safety
7. ✅ TailwindCSS (NativeWind) for styling
8. ✅ Real-time updates with Socket.IO
9. ✅ Optimistic UI updates
10. ✅ Error handling and loading states

## Dependencies
- `expo-router` - File-based routing
- `react-native-gesture-handler` - Drawer gestures
- `expo-router/drawer` - Drawer navigation
- `socket.io-client` - Real-time communication
- `nativewind` - TailwindCSS for React Native
- `axios` - HTTP requests
- `@10play/tentap-editor` - Rich text editing

## Notes
- All department-related functionality has been removed
- App now focuses solely on chat functionality
- Announcements are integrated into chat rooms
- Simple, clean, single-page design with drawer navigation

