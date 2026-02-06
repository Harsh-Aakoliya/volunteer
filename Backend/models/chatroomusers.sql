-- Table: public.chatroomusers

-- DROP TABLE IF EXISTS public.chatroomusers;

CREATE TABLE IF NOT EXISTS public.chatroomusers
(
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    "roomId" integer,
    "userId" integer,
    "isAdmin" integer,
    "canSendMessage" integer,
    createdby character varying COLLATE pg_catalog."default",
    modifiedon timestamp without time zone,
    modifiedby character varying COLLATE pg_catalog."default",
    "joinedAt" timestamp without time zone,
    CONSTRAINT "GroupMembers_pkey" PRIMARY KEY (id),
    CONSTRAINT unique_room_user UNIQUE ("roomId", "userId"),
    CONSTRAINT fk_chatroomusers_rooms FOREIGN KEY ("roomId")
        REFERENCES public.chatrooms ("roomId") MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;
