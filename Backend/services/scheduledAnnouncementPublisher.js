// scheduledAnnouncementPublisher.js
import cron from 'node-cron';
import pool from '../config/database.js';
import { sendAnnouncementNotifications } from '../controllers/notificationController.js';

class ScheduledAnnouncementPublisher {
  constructor() {
    this.isRunning = false;
    this.start();
  }

  start() {
    if (this.isRunning) {
      console.log('Scheduled announcement publisher is already running');
      return;
    }

    // Run every minute to check for scheduled announcements
    this.task = cron.schedule('* * * * *', async () => {
      await this.publishScheduledAnnouncements();
    }, {
      scheduled: false,
      timezone: "Asia/Kolkata" // IST timezone
    });

    this.task.start();
    this.isRunning = true;
    console.log('🕐 Scheduled announcement publisher started - checking every minute');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.isRunning = false;
      console.log('🛑 Scheduled announcement publisher stopped');
    }
  }

  async publishScheduledAnnouncements() {
    try {
      const now = new Date();
      console.log(`🔍 Checking for scheduled announcements at ${now.toISOString()}`);

      // Find announcements that are scheduled and whose time has arrived
      const query = `
        SELECT 
          a.*,
          u."fullName" as "authorName",
          u."departments" as "authorDepartments"
        FROM "announcements" a
        JOIN "users" u ON a."authorId" = u."userId"
        WHERE a."status" = 'scheduled' 
        AND a."createdAt" <= $1
        ORDER BY a."createdAt" ASC
      `;

      const result = await pool.query(query, [now]);

      if (result.rows.length === 0) {
        console.log('📭 No scheduled announcements ready to publish');
        return;
      }

      console.log(`📢 Found ${result.rows.length} scheduled announcement(s) ready to publish`);

      for (const announcement of result.rows) {
        await this.publishAnnouncement(announcement);
      }

    } catch (error) {
      console.error('❌ Error checking scheduled announcements:', error);
    }
  }

  async publishAnnouncement(announcement) {
    try {
      console.log(`🚀 Publishing scheduled announcement: "${announcement.title}" (ID: ${announcement.id})`);

      // Update announcement status to published
      const updateQuery = `
        UPDATE "announcements" 
        SET "status" = 'published', "updatedAt" = (NOW() AT TIME ZONE 'UTC')
        WHERE "id" = $1
        RETURNING *
      `;

      const updateResult = await pool.query(updateQuery, [announcement.id]);

      if (updateResult.rows.length === 0) {
        throw new Error(`Failed to update announcement ${announcement.id}`);
      }

      console.log(`✅ Successfully published announcement: "${announcement.title}"`);

      // Send notifications to users in the targeted departments
      try {
        await sendAnnouncementNotifications(
          announcement.id,
          announcement.authorId,
          announcement.authorName,
          announcement.title,
          announcement.departmentTag || []
        );
        console.log(`📱 Notifications sent for announcement: "${announcement.title}"`);
      } catch (notificationError) {
        console.error(`⚠️ Failed to send notifications for announcement ${announcement.id}:`, notificationError);
        // Don't fail the whole process if notifications fail
      }

    } catch (error) {
      console.error(`❌ Failed to publish announcement ${announcement.id}:`, error);
    }
  }


  // Method to manually trigger a check (useful for testing)
  async manualCheck() {
    console.log('🔍 Manual check triggered for scheduled announcements');
    await this.publishScheduledAnnouncements();
  }

  // Method to get status
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.task ? 'Every minute' : 'Not scheduled'
    };
  }
}

// Create and export a singleton instance
const scheduledPublisher = new ScheduledAnnouncementPublisher();

export default scheduledPublisher;
