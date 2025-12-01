# Chat Announcement Feature

## Quick Start

### To Use:
1. Open any chat room
2. Click the **+** button
3. Select **Announcement** from the attachment grid
4. Fill in title and content (use formatting toolbar)
5. Optionally attach images/videos
6. Click **Send Announcement**

### Result:
The announcement appears inline in the chat with:
- Distinctive colored border and megaphone icon
- Title in large bold text
- Formatted body content
- Media files in a grid (if attached)

---

## Overview
This feature allows users to create rich announcements directly within chat rooms with support for:
- **Title**: Bold heading for the announcement
- **Rich Text Content**: Formatted body with bold, italic, lists, alignment, etc.
- **Media Attachments**: Images and videos displayed in a grid

## How It Works

### User Flow
1. User is in a chat room (`/chat/[roomId]`)
2. User clicks the **+** icon to open attachments grid
3. User clicks **Announcement** icon
4. User is taken to `/chat/create-chat-announcement` route
5. User creates announcement with:
   - Title (required)
   - Rich text body (required)
   - Media files (optional - images/videos)
6. User clicks **Send Announcement**
7. Announcement appears inline in the chat room

### Technical Implementation

#### Frontend Components

**1. Create Chat Announcement Route** (`/app/chat/create-chat-announcement.tsx`)
- Combines media uploader + rich text editor functionality
- Uses Pell Rich Editor for formatted text
- Uploads media to temporary folder via `/api/vm-media/upload`
- On send, calls either:
  - `/api/vm-media/move-to-chat-announcement` (if media files present)
  - `/api/chat/rooms/${roomId}/messages` (if no media files)

**2. Attachments Grid** (`/app/chat/Attechments-grid.tsx`)
- Updated Announcement button to navigate to `/chat/create-chat-announcement`

**3. Chat Room Rendering** (`/app/chat/[roomId].tsx`)
- Detects `messageType === 'announcement'`
- Parses messageText to extract title and body using separator
- Renders inline with:
  - Header badge ("ANNOUNCEMENT")
  - Title in large bold text
  - Body rendered as HTML in WebView
  - Media grid (if mediaFilesId present)

#### Backend Endpoints

**1. New Endpoint: `/api/vm-media/move-to-chat-announcement`**
Location: `/Backend/controllers/vmMediaController.js`

```javascript
moveToChatAnnouncement: async (req, res) => {
  // Accepts: tempFolderId, roomId, senderId, filesWithCaptions, messageText, messageType
  // Creates chat message with type 'announcement'
  // Moves media files from temp to permanent folder
  // Creates media record and links to message
  // Returns: messageId, mediaId, createdAt, driveUrlObject
}
```

**2. Existing Endpoint: `/api/chat/rooms/${roomId}/messages`**
- Already supports `messageType: 'announcement'`
- Used when sending announcements without media files

### Data Format

#### Message Text Format
```
{title}|||ANNOUNCEMENT_SEPARATOR|||{richTextBody}
```

Example:
```
Important Update|||ANNOUNCEMENT_SEPARATOR|||<p>Please note that <b>office will be closed</b> tomorrow.</p><ul><li>Item 1</li><li>Item 2</li></ul>
```

#### Database Schema
The announcement uses existing message structure:
- `messageType`: 'announcement'
- `messageText`: Title + separator + body (HTML)
- `mediaFilesId`: Reference to media table (optional)
- `roomId`, `senderId`, `createdAt`: Standard message fields

#### Media Storage
Media files follow the same pattern as regular chat media:
- Temp folder: `media/chat/temp_{uuid}`
- Permanent folder: `media/chat/{timestamp}_{roomId}_{senderId}_{messageId}`
- Database: `media` table with `driveUrlObject` JSON array

### Rendering Details

The announcement message renders with:

1. **Visual Distinction**
   - Blue border-left for own messages
   - Orange border-left for others' messages
   - Light background color (blue-50 or orange-50)
   - Megaphone icon with "ANNOUNCEMENT" badge

2. **Content Layout**
   ```
   [MEGAPHONE ICON] ANNOUNCEMENT
   ================================
   Title (large, bold)
   
   Body content (HTML rendered)
   
   [Media Grid] (if files attached)
   ```

3. **Media Grid**
   - Uses existing `MediaGrid` component
   - Displays images/videos in responsive grid
   - Clicking opens full-screen media viewer
   - Supports captions and multiple files

### Key Features

1. **No Navigation Required**
   - Announcements render inline in chat
   - No need to click "View" to see content
   - Scrollable within chat feed

2. **Rich Text Support**
   - Bold, italic, underline
   - Bullet and numbered lists
   - Text alignment (left, center, right)
   - Undo/redo functionality

3. **Media Integration**
   - VM Media system (server-side storage)
   - Supports multiple images and videos
   - Preview before sending
   - Remove files individually

4. **Real-time Updates**
   - Socket.io integration
   - Instant delivery to all room members
   - Proper message ordering

5. **Message Actions**
   - Can be selected for forwarding (if admin)
   - Can be deleted by sender (if admin)
   - Shows read receipts (if admin)
   - Cannot be edited (by design)

## File Changes Summary

### New Files
- `/app/chat/create-chat-announcement.tsx` - Combined creator UI

### Modified Files
- `/app/chat/Attechments-grid.tsx` - Updated navigation
- `/app/chat/[roomId].tsx` - Added announcement rendering
- `/Backend/controllers/vmMediaController.js` - Added `moveToChatAnnouncement` function
- `/Backend/routes/vmMediaRoutes.js` - Added route for new endpoint

### No Changes Needed
- Database schema (already supports announcement type)
- Media table structure
- Socket.io events
- Message forwarding/deletion logic

## Usage Example

### Creating an Announcement
```typescript
// In chat room, user clicks + icon → Announcement
// Navigates to create-chat-announcement with roomId and userId

// User fills in:
title = "Team Meeting Tomorrow"
body = "<p>Please join us for the <b>quarterly review</b>.</p><ul><li>Time: 10 AM</li><li>Location: Conference Room</li></ul>"
mediaFiles = [image1.jpg, image2.jpg]

// On send, creates:
messageText = "Team Meeting Tomorrow|||ANNOUNCEMENT_SEPARATOR|||<p>Please join us for the <b>quarterly review</b>...</p>"
messageType = "announcement"
mediaFilesId = 123 (links to media table)
```

### Rendering in Chat
```typescript
// Parse messageText
const [title, body] = messageText.split("|||ANNOUNCEMENT_SEPARATOR|||");

// Render:
// [🔊 ANNOUNCEMENT]
// Team Meeting Tomorrow
// Please join us for the quarterly review.
//   • Time: 10 AM
//   • Location: Conference Room
// [Image Grid: image1.jpg, image2.jpg]
```

## Testing Checklist

- [ ] Create announcement with title + body only
- [ ] Create announcement with title + body + media
- [ ] Verify inline rendering in chat
- [ ] Verify media grid display
- [ ] Test real-time delivery via socket
- [ ] Test announcement from different users
- [ ] Verify proper formatting (bold, lists, alignment)
- [ ] Test media file removal before sending
- [ ] Test navigation back with unsaved changes
- [ ] Verify temp folder cleanup on discard

## Future Enhancements (Optional)

1. **Mention Support**: Allow @mentions in announcement body
2. **Scheduling**: Schedule announcements for future delivery
3. **Pin Announcements**: Pin important announcements to top
4. **Announcement Analytics**: Track who viewed/read announcement
5. **Templates**: Pre-defined announcement templates
6. **Draft Saving**: Save announcements as drafts

## Notes

- Separator string `|||ANNOUNCEMENT_SEPARATOR|||` is used to split title and body
  - Easy to parse
  - Unlikely to appear in user content
  - Can be changed if needed

- WebView is used to render HTML body
  - Provides proper formatting
  - Handles complex HTML structures
  - Sandboxed for security

- Existing media system is reused
  - No new tables or storage logic needed
  - Consistent with other chat media
  - Same permissions and access control

