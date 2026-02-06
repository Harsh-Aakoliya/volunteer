-- Table: public.poll

-- DROP TABLE IF EXISTS public.poll;

CREATE TABLE IF NOT EXISTS public.poll
(
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    question text COLLATE pg_catalog."default" NOT NULL,
    options jsonb NOT NULL,
    votes jsonb,
    "roomId" integer,
    "isActive" boolean DEFAULT true,
    "pollEndTime" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    "isMultipleChoiceAllowed" boolean DEFAULT false,
    "createdBy" character varying(50) COLLATE pg_catalog."default",
    "createdAt" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT poll_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;