-- Team collaboration & share links
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'view' CHECK (role IN ('view', 'edit')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_share_links_token_idx ON public.project_share_links (token);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON public.project_members (user_id);

ALTER TABLE public.project_repos ADD COLUMN IF NOT EXISTS last_pulled_at TIMESTAMPTZ;

-- Community template marketplace (curated + extensible)
CREATE TABLE IF NOT EXISTS public.community_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT NOT NULL DEFAULT '',
  description_en TEXT,
  emoji TEXT NOT NULL DEFAULT '✨',
  prompt TEXT NOT NULL,
  style_id TEXT NOT NULL DEFAULT 'minimal-saas',
  author TEXT,
  source_url TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members view own teams"
  ON public.teams FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid())
  );

CREATE POLICY "Owners manage teams"
  ON public.teams FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Team members view membership"
  ON public.team_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Owners manage team members"
  ON public.team_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.owner_id = auth.uid()));

CREATE POLICY "Project owner manages members"
  ON public.project_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND p.user_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Members view project membership"
  ON public.project_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Project owner manages share links"
  ON public.project_share_links FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_share_links.project_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_share_links.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Anyone reads community templates"
  ON public.community_templates FOR SELECT
  USING (true);

-- Collaborators can read/update projects they belong to
CREATE POLICY "Collaborators view shared projects"
  ON public.projects FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Editors update shared projects"
  ON public.projects FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid() AND pm.role = 'editor'
    )
  );

-- Seed community templates (idempotent)
INSERT INTO public.community_templates (slug, name, name_en, description, description_en, emoji, prompt, style_id, author, source_url, featured)
VALUES
  ('notion-docs', 'Notion 风格文档站', 'Notion-style docs', '侧边栏 + 文档阅读', 'Sidebar docs layout', '📚',
   '做一个 Notion 风格的文档站：左侧目录树、右侧 Markdown 风格正文、顶部搜索、深色/浅色切换。', 'minimal-saas', 'TensorView', 'https://github.com/qlghmz/ai-tensorview-cc', true),
  ('crypto-dashboard', 'Web3 仪表盘', 'Web3 dashboard', '链上数据看板', 'On-chain analytics', '⛓️',
   '做一个 Web3 仪表盘：钱包连接按钮、TVL/Volume 指标卡、折线图占位、最近交易列表。', 'dark-dev', 'Community', NULL, true),
  ('restaurant-menu', '餐厅菜单', 'Restaurant menu', '扫码点餐风', 'QR menu style', '🍜',
   '做一个餐厅在线菜单：分类 Tab、菜品卡片带价格与辣度、购物车浮层、下单 CTA。', 'warm-commerce', 'Community', NULL, false),
  ('news-magazine', '科技资讯', 'Tech magazine', '杂志式排版', 'Magazine layout', '📰',
   '做一个科技资讯杂志首页：头条大图、三栏文章列表、Newsletter 订阅、标签云。', 'corporate', 'Community', NULL, false)
ON CONFLICT (slug) DO NOTHING;
