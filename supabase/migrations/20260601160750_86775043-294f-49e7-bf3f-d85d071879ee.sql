-- 清洗历史脏数据：把误存为内部 serverFn 路径或非 https 的 published_url 清空
UPDATE public.projects
SET published_url = NULL
WHERE published_url IS NOT NULL
  AND (published_url LIKE '%/_serverFn/%'
       OR position('://' in published_url) = 0
       OR published_url NOT LIKE 'https://%');