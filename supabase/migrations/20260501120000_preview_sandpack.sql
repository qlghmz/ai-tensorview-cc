-- React / Sandpack bundle (Lovable-style multi-file) stored as JSON
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS preview_sandpack jsonb;

COMMENT ON COLUMN public.projects.preview_sandpack IS 'Lovable-style bundle: { routes: [{path,label}], files: { "/App.tsx": "..." } }';
