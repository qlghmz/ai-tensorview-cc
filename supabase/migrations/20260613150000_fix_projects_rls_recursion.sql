-- Fix infinite RLS recursion: projects <-> project_members circular policies.
-- Use SECURITY DEFINER helpers so policy checks do not re-enter RLS.

CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_editor(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND role = 'editor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_project_editor(uuid, uuid) TO authenticated, anon;

-- projects (collaborator access)
DROP POLICY IF EXISTS "Collaborators view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Editors update shared projects" ON public.projects;

CREATE POLICY "Collaborators view shared projects"
  ON public.projects FOR SELECT
  USING (public.is_project_member(id, auth.uid()));

CREATE POLICY "Editors update shared projects"
  ON public.projects FOR UPDATE
  USING (public.is_project_editor(id, auth.uid()));

-- project_members
DROP POLICY IF EXISTS "Project owner manages members" ON public.project_members;
DROP POLICY IF EXISTS "Members view project membership" ON public.project_members;

CREATE POLICY "Project owner manages members"
  ON public.project_members FOR ALL
  USING (public.is_project_owner(project_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Members view project membership"
  ON public.project_members FOR SELECT
  USING (public.is_project_owner(project_id, auth.uid()) OR user_id = auth.uid());

-- project_share_links
DROP POLICY IF EXISTS "Project owner manages share links" ON public.project_share_links;

CREATE POLICY "Project owner manages share links"
  ON public.project_share_links FOR ALL
  USING (public.is_project_owner(project_id, auth.uid()))
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));

-- project_versions (avoid projects subquery under RLS)
DROP POLICY IF EXISTS "Users view own project versions" ON public.project_versions;
DROP POLICY IF EXISTS "Users insert own project versions" ON public.project_versions;
DROP POLICY IF EXISTS "Users delete own project versions" ON public.project_versions;

CREATE POLICY "Users view own project versions"
  ON public.project_versions FOR SELECT
  USING (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Users insert own project versions"
  ON public.project_versions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_project_owner(project_id, auth.uid())
      OR public.is_project_editor(project_id, auth.uid())
    )
  );

CREATE POLICY "Users delete own project versions"
  ON public.project_versions FOR DELETE
  USING (public.is_project_owner(project_id, auth.uid()));
