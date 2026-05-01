ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS published_url text;
COMMENT ON COLUMN public.projects.published_url IS '客户发布到 EdgeOne 后的公开访问 URL（独立域名，无平台外壳）';