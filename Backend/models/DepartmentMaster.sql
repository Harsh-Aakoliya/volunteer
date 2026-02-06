-- Table: public.DepartmentMaster

-- DROP TABLE IF EXISTS public."DepartmentMaster";

CREATE TABLE IF NOT EXISTS public."DepartmentMaster"
(
    deptid integer NOT NULL,
    deptname character varying COLLATE pg_catalog."default",
    isactive integer
)

TABLESPACE pg_default;
