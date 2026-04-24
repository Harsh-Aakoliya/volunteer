-- Table: public.community

-- DROP TABLE IF EXISTS public.community;

CREATE TABLE IF NOT EXISTS public.community
(
    "communityId" INTEGER GENERATED ALWAYS AS IDENTITY,
    "communityName" character varying COLLATE pg_catalog."default",
    "communityDescription" character varying COLLATE pg_catalog."default",
    "isactive" integer DEFAULT 1,
    "createdon" timestamp without time zone,
    "modifiedon" timestamp without time zone,
    "createdby" character varying COLLATE pg_catalog."default",
    "modifiedby" character varying COLLATE pg_catalog."default",
    CONSTRAINT "Community_pkey" PRIMARY KEY ("communityId")
)

TABLESPACE pg_default;
