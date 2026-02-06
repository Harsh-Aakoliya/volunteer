-- Table: public.SevakMaster

-- DROP TABLE IF EXISTS public."SevakMaster";

CREATE TABLE IF NOT EXISTS public."SevakMaster"
(
    seid integer NOT NULL,
    sevakname character varying COLLATE pg_catalog."default",
    mobileno character varying COLLATE pg_catalog."default",
    isactive integer,
    password character varying COLLATE pg_catalog."default",
    canlogin integer,
    isadmin integer,
    deptname character varying COLLATE pg_catalog."default",
    usertype character varying COLLATE pg_catalog."default",
    createdon timestamp without time zone,
    createdby character varying COLLATE pg_catalog."default",
    modifiedon timestamp without time zone,
    modifiedby chararcter varying COLLATE pg_catalog."default",
    birthdate date,
    bloodgroup character varying COLLATE pg_catalog."default",
    emergencycontact1 character varying COLLATE pg_catalog."default",
    emrgencycontactno1 character varying COLLATE pg_catalog."default",
    emergencycontact2 character varying COLLATE pg_catalog."default",
    emrgencycontactno2 character varying COLLATE pg_catalog."default",
    sevakid character varying COLLATE pg_catalog."default",
    firsttimelogin integer,
    emergencycontactrelation1 character varying COLLATE pg_catalog."default",
    emergencycontactrelation2 character varying COLLATE pg_catalog."default"
)

TABLESPACE pg_default;