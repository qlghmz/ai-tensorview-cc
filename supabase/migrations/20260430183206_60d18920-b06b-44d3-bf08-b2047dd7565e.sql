ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE POLICY "Public projects are viewable by everyone"
ON public.projects
FOR SELECT
USING (is_public = true);