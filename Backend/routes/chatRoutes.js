// routes/chatRoutes.js
import express from 'express';
import chatController from '../controllers/chatController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Chat users and rooms
router.get('/users', chatController.getChatUsers);//${API_URL}/api/chat/users api/chat/rooms.ts -> fetchChatUsers
router.get('/rooms', chatController.getChatRooms);//${API_URL}/api/chat/rooms api/chat/rooms.ts -> fetchChatRooms
router.post('/rooms', chatController.createChatRoom);// api/chat/rooms.ts -> createChatRoom

// Room details
router.get('/rooms/:roomId', chatController.getChatRoomDetails);//${API_URL}/api/chat/rooms/${roomId} app/chat/[roomId].tsx -> loadRoomDetails,// app/chat/room-info.tsx ->loadRoomInfo
router.delete('/rooms/:roomId', chatController.deleteChatRoom);//${API_URL}/api/chat/rooms/${roomId} room info will needed

// Room settings
router.put('/rooms/:roomId/settings', chatController.updateRoomSettings);//${API_URL}/api/chat/rooms/${roomId}/settings api/chat/rooms.ts ->renameRoom
router.put('/rooms/:roomId/admins', chatController.updateGroupAdmins);//${API_URL}/api/chat/rooms/${roomId}/admins // api/chat/rooms.ts -> updateGroupAdmins

router.put('/rooms/:roomId/messaging-permissions', chatController.updateMessagingPermissions);//${API_URL}/api/chat/rooms/${roomId}/messaging-permissions  api/chat/rooms.ts->updateMessagingPermissions
router.post('/rooms/:roomId/leave', chatController.leaveRoom);// api/chat/rooms.ts -> leaveRoom

// Room members
router.put('/rooms/:roomId/members', chatController.updateRoomMembers);//${API_URL}/api/chat/rooms/${roomId}/members api/chat/rooms.ts->updateRoomMembers

// Room messages
router.post('/rooms/:roomId/messages', chatController.sendMessage);//${API_URL}/api/chat/rooms/${roomId}/messages // app/chat/[roomId].tsx -> sendMessage,handleForwardMessages, app/chat/create-chat-announcement.tsx -> sendAnnouncement, app/chat/Polling.tsx -> sendpollinmessage, app/chat/table.tsx -> sendTableToChat
router.get('/rooms/:roomId/messages', chatController.getNewMessages); //${API_URL}/api/chat/rooms/${roomId}/messages api/chat/message.ts -> getNewMessages
router.put('/rooms/:roomId/messages/:messageId', chatController.editMessage);//${API_URL}/api/chat/rooms/${roomIdValue}/messages/${messageId} // components/chat/EditMessageModal.tsx->handleSave
router.delete('/rooms/:roomId/messages', chatController.deleteMessages);// app/chat/[roomId].tsx -> handleDeleteMessages

// Scheduled messages
router.get('/rooms/:roomId/scheduled-messages', chatController.getScheduledMessages); //${API_URL}/api/chat/rooms/${roomId}/scheduled-messages api/chat/message.ts -> getScheduledMessages

// Message read status
router.get('/messages/:messageId/read-status', chatController.getMessageReadStatus); //${API_URL}/api/chat/messages/${messageId}/read-status app/chat/[roomId].tsx -> fetchReadStatus
router.post('/messages/:messageId/mark-read', chatController.markMessageAsRead); // app/chat/[roomId].tsx -> markMessageAsRead

export default router;