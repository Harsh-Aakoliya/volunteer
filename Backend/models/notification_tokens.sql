-- Table: public.notification_tokens

-- DROP TABLE IF EXISTS public.notification_tokens;

CREATE TABLE IF NOT EXISTS public.notification_tokens
(
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    "userId" character varying(50) COLLATE pg_catalog."default" NOT NULL,
    token text COLLATE pg_catalog."default" NOT NULL,
    "tokenType" character varying(20) COLLATE pg_catalog."default" DEFAULT 'fcm'::character varying,
    "deviceInfo" jsonb DEFAULT '{}'::jsonb,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    "updatedAt" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT notification_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT "notification_tokens_userId_tokenType_key" UNIQUE ("userId", "tokenType")
)

TABLESPACE pg_default;
