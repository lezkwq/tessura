ALTER TABLE public.audits ADD COLUMN complement text NOT NULL DEFAULT '';
ALTER TABLE public.audits ADD COLUMN observation_state jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.businesses ADD COLUMN audit_notes jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audits ADD CONSTRAINT audits_complement_length CHECK (char_length(complement) <= 300);