-- Table: public.chatrooms

-- DROP TABLE IF EXISTS public.chatrooms;

CREATE TABLE IF NOT EXISTS public.chatrooms
(
    "roomId" INTEGER GENERATED ALWAYS AS IDENTITY,
    "roomName" character varying COLLATE pg_catalog."default",
    isactive integer,
    modifiedon timestamp without time zone,
    createdon timestamp without time zone,
    createdby character varying COLLATE pg_catalog."default",
    modifiedby character varying COLLATE pg_catalog."default",
    "communityId" INTEGER DEFAULT -1,
    CONSTRAINT "GroupMaster_pkey" PRIMARY KEY ("roomId")
)

TABLESPACE pg_default;

-- Idempotent migration: ensure "communityId" column exists and defaults to -1
ALTER TABLE public.chatrooms
    ADD COLUMN IF NOT EXISTS "communityId" INTEGER DEFAULT -1;

UPDATE public.chatrooms SET "communityId" = -1 WHERE "communityId" IS NULL;
