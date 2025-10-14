// run_migration.js
import pool from '../config/database.js';

async function runMigration() {
  try {
    console.log('Running scheduled messages migration...');
    
    // Add isScheduled column to chatmessages table
    await pool.query(`
      ALTER TABLE chatmessages ADD COLUMN IF NOT EXISTS "isScheduled" BOOLEAN DEFAULT FALSE;
    `);
    
    // Create index for better performance on scheduled message queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chatmessages_scheduled ON chatmessages ("isScheduled", "createdAt") WHERE "isScheduled" = TRUE;
    `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
