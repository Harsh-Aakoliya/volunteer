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
    CONSTRAINT "GroupMaster_pkey" PRIMARY KEY ("roomId")
)

TABLESPACE pg_default;

