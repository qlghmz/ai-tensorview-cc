-- 1) 用户部署 Token 表
CREATE TABLE public.user_deploy_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('vercel','netlify','cloudflare')),
  token_encrypted text NOT NULL,
  token_tail text NOT NULL,
  team_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, DELETE ON public.user_deploy_tokens TO authenticated;
GRANT ALL ON public.user_deploy_tokens TO service_role;

ALTER TABLE public.user_deploy_tokens ENABLE ROW LEVEL SECURITY;

-- 仅允许用户查询/删除自己那一行；明文 INSERT/UPDATE 走 service_role
CREATE POLICY "Users can view own deploy tokens"
ON public.user_deploy_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own deploy tokens"
ON public.user_deploy_tokens FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_deploy_tokens_updated_at
BEFORE UPDATE ON public.user_deploy_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) projects 加 Vercel 相关字段
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS vercel_project_id text,
  ADD COLUMN IF NOT EXISTS vercel_deployment_url text;