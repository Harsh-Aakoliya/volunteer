// utils/notificationTester.ts
// This utility helps test notification flows in development
import eventEmitter from './eventEmitter';
import { notificationHandler } from './notificationHandler';

export class NotificationTester {
  
  // Test announcement notification
  static testAnnouncementNotification(announcementId: number) {
    console.log('🧪 Testing announcement notification for ID:', announcementId);
    eventEmitter.emit('openAnnouncement', { announcementId });
  }
  
  // Test chat room notification
  static testChatRoomNotification(roomId: string) {
    console.log('🧪 Testing chat room notification for ID:', roomId);
    eventEmitter.emit('openChatRoom', { roomId });
  }
  
  // Test full announcement notification flow (simulates backend notification)
  static async testFullAnnouncementFlow(announcementId: string) {
    console.log('🧪 Testing full announcement notification flow for ID:', announcementId);
    
    // Simulate the full notification data that would come from backend
    const notificationData = {
      type: 'announcement' as const,
      announcementId,
      title: 'Test Announcement',
      body: 'This is a test notification'
    };
    
    // This would normally be called by the notification response handler
    await (notificationHandler as any).handleNotificationNavigation(notificationData);
  }
  
  // Test full chat notification flow (simulates backend notification)
  static async testFullChatFlow(roomId: string) {
    console.log('🧪 Testing full chat notification flow for room ID:', roomId);
    
    // Simulate the full notification data that would come from backend
    const notificationData = {
      type: 'chat' as const,
      roomId,
      title: 'New Message',
      body: 'You have a new message'
    };
    
    // This would normally be called by the notification response handler
    await (notificationHandler as any).handleNotificationNavigation(notificationData);
  }
  
  // Test EventEmitter functionality
  static testEventEmitter() {
    console.log('🧪 Testing EventEmitter functionality...');
    
    // Set up test listeners
    const testListener1 = (data: any) => console.log('📱 Test Listener 1 received:', data);
    const testListener2 = (data: any) => console.log('📱 Test Listener 2 received:', data);
    
    // Add listeners
    eventEmitter.on('testEvent', testListener1);
    eventEmitter.on('testEvent', testListener2);
    
    // Emit test event
    eventEmitter.emit('testEvent', { message: 'Hello from EventEmitter!' });
    
    // Clean up
    setTimeout(() => {
      eventEmitter.off('testEvent', testListener1);
      eventEmitter.off('testEvent', testListener2);
      console.log('🧹 Cleaned up test listeners');
    }, 1000);
  }
  
  // Log current EventEmitter state
  static logEventEmitterState() {
    console.log('📊 EventEmitter State:', (eventEmitter as any).events);
  }
}

// Global helper functions for easy testing in development
if (__DEV__) {
  (global as any).testAnnouncementNotification = NotificationTester.testAnnouncementNotification;
  (global as any).testChatRoomNotification = NotificationTester.testChatRoomNotification;
  (global as any).testFullAnnouncementFlow = NotificationTester.testFullAnnouncementFlow;
  (global as any).testFullChatFlow = NotificationTester.testFullChatFlow;
  (global as any).testEventEmitter = NotificationTester.testEventEmitter;
  (global as any).logEventEmitterState = NotificationTester.logEventEmitterState;
  
  console.log('🛠️ Notification testing functions available globally:');
  console.log('   - testAnnouncementNotification(announcementId)');
  console.log('   - testChatRoomNotification(roomId)');
  console.log('   - testFullAnnouncementFlow(announcementId)');
  console.log('   - testFullChatFlow(roomId)');
  console.log('   - testEventEmitter()');
  console.log('   - logEventEmitterState()');
}

export default NotificationTester;
