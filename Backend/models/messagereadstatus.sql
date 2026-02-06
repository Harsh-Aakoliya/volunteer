-- Table: public.messagereadstatus

-- DROP TABLE IF EXISTS public.messagereadstatus;

CREATE TABLE IF NOT EXISTS public.messagereadstatus
(
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    "messageId" integer NOT NULL,
    "readAt" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    "roomId" integer NOT NULL,
    "userId" integer,
    CONSTRAINT messagereadstatus_pkey PRIMARY KEY (id),
    CONSTRAINT fk_messagereadstatus_message FOREIGN KEY ("messageId")
        REFERENCES public.chatmessages (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_messagereadstatus_room FOREIGN KEY ("roomId")
        REFERENCES public.chatrooms ("roomId") MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;


-- ALTER TABLE messagereadstatus
--     ADD CONSTRAINT unique_message_user
--         UNIQUE ("messageId", "userId");

