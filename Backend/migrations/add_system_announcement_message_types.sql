-- Add 'system' and 'announcement' to messageType enum
-- Note: ALTER TYPE ... ADD VALUE cannot be run inside a transaction block
-- This migration should be run manually or with special handling

-- Add 'system' to messageType enum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'system' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'messageType')
    ) THEN
        ALTER TYPE "messageType" ADD VALUE 'system';
    END IF;
END $$;

-- Add 'announcement' to messageType enum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'announcement' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'messageType')
    ) THEN
        ALTER TYPE "messageType" ADD VALUE 'announcement';
    END IF;
END $$;

