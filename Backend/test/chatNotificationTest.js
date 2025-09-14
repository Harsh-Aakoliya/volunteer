// Backend/test/chatNotificationTest.js
// Test utility for chat notification system

import pool from "../config/database.js";
import { sendChatNotifications } from "../controllers/chatNotificationController.js";

// Mock socket data for testing
const createMockSocketData = () => {
  const socketToUser = new Map();
  const userToSockets = new Map();
  
  // Add some mock users
  const mockUsers = [
    { userId: 'user1', socketId: 'socket1', userName: 'John Doe', isOnChatTab: false, currentRooms: [] },
    { userId: 'user2', socketId: 'socket2', userName: 'Jane Smith', isOnChatTab: true, currentRooms: ['123'] },
    { userId: 'user3', socketId: 'socket3', userName: 'Bob Johnson', isOnChatTab: true, currentRooms: ['456'] },
  ];
  
  mockUsers.forEach(user => {
    socketToUser.set(user.socketId, {
      userId: user.userId,
      userName: user.userName,
      isOnChatTab: user.isOnChatTab,
      currentRooms: user.currentRooms
    });
    
    userToSockets.set(user.userId, new Set([user.socketId]));
  });
  
  return { socketToUser, userToSockets };
};

// Mock IO object
const createMockIO = () => ({
  to: (room) => ({
    emit: (event, data) => {
      console.log(`📡 Mock emit to ${room}: ${event}`, data);
    }
  }),
  fetchSockets: async () => []
});

// Test notification logic without actually sending FCM
export const testNotificationLogic = async () => {
  console.log('🧪 Testing chat notification logic...');
  
  const { socketToUser, userToSockets } = createMockSocketData();
  const mockIO = createMockIO();
  
  // Mock message
  const mockMessage = {
    id: 1,
    messageText: 'Hello everyone! This is a test message.',
    messageType: 'text',
    createdAt: new Date().toISOString(),
    replyMessageId: null
  };
  
  // Mock sender
  const mockSender = {
    userId: 'sender1',
    userName: 'Test Sender'
  };
  
  // Mock room
  const mockRoom = {
    roomId: 123,
    roomName: 'Test Room'
  };
  
  try {
    await sendChatNotifications(
      mockMessage,
      mockSender, 
      mockRoom,
      mockIO,
      socketToUser,
      userToSockets
    );
    
    console.log('✅ Notification logic test completed');
  } catch (error) {
    console.error('❌ Notification logic test failed:', error);
  }
};

// Test database setup
export const testDatabaseSetup = async () => {
  console.log('🧪 Testing database setup...');
  
  try {
    // Check if notification_tokens table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'notification_tokens'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ notification_tokens table exists');
      
      // Check table structure
      const columnsResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'notification_tokens'
        ORDER BY ordinal_position;
      `);
      
      console.log('📋 Table columns:', columnsResult.rows);
    } else {
      console.log('❌ notification_tokens table does not exist');
    }
    
    // Test token insertion
    const testUserId = 'test_user_' + Date.now();
    const testToken = 'test_token_' + Date.now();
    
    const insertResult = await pool.query(`
      INSERT INTO notification_tokens ("userId", "token", "tokenType")
      VALUES ($1, $2, 'fcm')
      RETURNING *
    `, [testUserId, testToken]);
    
    console.log('✅ Test token inserted:', insertResult.rows[0]);
    
    // Clean up test data
    await pool.query('DELETE FROM notification_tokens WHERE "userId" = $1', [testUserId]);
    console.log('🧹 Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
};

// Test room membership queries
export const testRoomMembershipQueries = async () => {
  console.log('🧪 Testing room membership queries...');
  
  try {
    // Get all chat rooms
    const roomsResult = await pool.query('SELECT "roomId", "roomName" FROM chatrooms LIMIT 5');
    console.log('📋 Available chat rooms:', roomsResult.rows);
    
    if (roomsResult.rows.length > 0) {
      const testRoomId = roomsResult.rows[0].roomId;
      
      // Get room members
      const membersResult = await pool.query(`
        SELECT u."userId", u."fullName" 
        FROM chatroomusers cru
        JOIN "users" u ON cru."userId" = u."userId"
        WHERE cru."roomId" = $1
      `, [testRoomId]);
      
      console.log(`👥 Members in room ${testRoomId}:`, membersResult.rows);
      
      // Test notification token query for these users
      if (membersResult.rows.length > 0) {
        const userIds = membersResult.rows.map(member => member.userId);
        
        const tokensResult = await pool.query(`
          SELECT "userId", "token", "isActive" 
          FROM notification_tokens 
          WHERE "userId" = ANY($1) AND "isActive" = TRUE AND "tokenType" = 'fcm'
        `, [userIds]);
        
        console.log('🔑 Active FCM tokens for room members:', tokensResult.rows);
      }
    }
    
  } catch (error) {
    console.error('❌ Room membership test failed:', error);
  }
};

// Run all tests
export const runAllTests = async () => {
  console.log('🚀 Starting chat notification system tests...\n');
  
  await testDatabaseSetup();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testRoomMembershipQueries();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testNotificationLogic();
  console.log('\n✅ All tests completed!');
};

// Export for use in other files
export default {
  testNotificationLogic,
  testDatabaseSetup,
  testRoomMembershipQueries,
  runAllTests
};
