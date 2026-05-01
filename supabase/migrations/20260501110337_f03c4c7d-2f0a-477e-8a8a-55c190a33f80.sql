-- Per-user code hosting integrations (Gitee, GitHub)
CREATE TABLE public.user_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gitee', 'github')),
  access_token TEXT NOT NULL,
  username TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
ON public.user_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
ON public.user_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
ON public.user_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
ON public.user_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Track which projects have been pushed where (for "push" vs "create")
CREATE TABLE public.project_repos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gitee', 'github')),
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  last_pushed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, provider)
);

ALTER TABLE public.project_repos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project repos"
ON public.project_repos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own project repos"
ON public.project_repos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own project repos"
ON public.project_repos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own project repos"
ON public.project_repos FOR DELETE
USING (auth.uid() = user_id);