-- Table: public.chatmessages

-- DROP TABLE IF EXISTS public.chatmessages;

CREATE TABLE IF NOT EXISTS public.chatmessages
(
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    "roomId" integer,
    "messageText" text COLLATE pg_catalog."default" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    "messageType" "messageType" NOT NULL DEFAULT 'text'::"messageType",
    "pollId" integer,
    "mediaFilesId" integer,
    "tableId" integer,
    "isEdited" boolean DEFAULT false,
    "editedAt" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    "editedBy" character varying(50) COLLATE pg_catalog."default",
    "replyMessageId" integer,
    "isScheduled" boolean DEFAULT false,
    "senderId" integer,
    CONSTRAINT chatmessages_pkey PRIMARY KEY (id),
    CONSTRAINT fk_chatmessages_media FOREIGN KEY ("mediaFilesId")
        REFERENCES public.media (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT fk_chatmessages_poll FOREIGN KEY ("pollId")
        REFERENCES public.poll (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT fk_chatmessages_reply FOREIGN KEY ("replyMessageId")
        REFERENCES public.chatmessages (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT fk_chatmessages_rooms FOREIGN KEY ("roomId")
        REFERENCES public.chatrooms ("roomId") MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;
