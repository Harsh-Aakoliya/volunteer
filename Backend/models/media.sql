-- Table: public.media

-- DROP TABLE IF EXISTS public.media;

CREATE TABLE IF NOT EXISTS public.media
(
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    "roomId" integer,
    "senderId" character varying(50) COLLATE pg_catalog."default",
    "createdAt" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    caption character varying(255) COLLATE pg_catalog."default",
    "messageId" integer,
    "driveUrlObject" jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT media_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;
