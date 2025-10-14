// services/scheduledMessageService.js
import pool from "../config/database.js";
import chatController from "../controllers/chatController.js";

class ScheduledMessageService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Scheduled message service is already running');
      return;
    }

    console.log('Starting scheduled message service...');
    this.isRunning = true;
    
    // Check for scheduled messages every minute
    this.intervalId = setInterval(async () => {
      await this.checkAndSendScheduledMessages();
    }, 60000); // 60 seconds

    // Also check immediately on start
    this.checkAndSendScheduledMessages();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Scheduled message service stopped');
  }

  async checkAndSendScheduledMessages() {
    try {
      // Get all scheduled messages that are due to be sent
      const result = await pool.query(
        `SELECT "id" FROM chatmessages 
        WHERE "isScheduled" = TRUE 
        AND "createdAt" <= NOW() AT TIME ZONE 'UTC'
        ORDER BY "createdAt" ASC`
      );

      if (result.rows.length > 0) {
        console.log(`Found ${result.rows.length} scheduled messages to send`);
        
        // Send each scheduled message
        for (const row of result.rows) {
          try {
            await chatController.sendScheduledMessage(row.id);
          } catch (error) {
            console.error(`Error sending scheduled message ${row.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking scheduled messages:', error);
    }
  }

  // Method to manually trigger a check (useful for testing)
  async triggerCheck() {
    await this.checkAndSendScheduledMessages();
  }
}

// Create a singleton instance
const scheduledMessageService = new ScheduledMessageService();

export default scheduledMessageService;
