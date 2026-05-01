ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS published_html text;

CREATE UNIQUE INDEX IF NOT EXISTS projects_public_slug_key
  ON public.projects (public_slug)
  WHERE public_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_project_slug()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
  exists_count int;
BEGIN
  LOOP
    candidate := lower(substr(encode(gen_random_bytes(6), 'base64'), 1, 7));
    candidate := regexp_replace(candidate, '[^a-z0-9]', '', 'g');
    IF length(candidate) < 5 THEN
      CONTINUE;
    END IF;
    SELECT count(*) INTO exists_count FROM public.projects WHERE public_slug = candidate;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN candidate;
END;
$$;