UPDATE public.projects
SET preview_sandpack = NULL, preview_html = NULL, updated_at = now()
WHERE id = 'dc8378bd-2b82-478d-adc9-cdeaabbf7b61';

DELETE FROM public.messages
WHERE project_id = 'dc8378bd-2b82-478d-adc9-cdeaabbf7b61'
  AND role = 'assistant'
  AND content LIKE '%自动补全%';