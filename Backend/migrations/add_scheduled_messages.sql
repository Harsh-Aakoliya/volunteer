-- Add isScheduled column to chatmessages table
ALTER TABLE chatmessages ADD COLUMN IF NOT EXISTS "isScheduled" BOOLEAN DEFAULT FALSE;

-- Create index for better performance on scheduled message queries
CREATE INDEX IF NOT EXISTS idx_chatmessages_scheduled ON chatmessages ("isScheduled", "createdAt") WHERE "isScheduled" = TRUE;
