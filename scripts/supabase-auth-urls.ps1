# Supabase Auth URL checklist — set $ProjectRef and $SiteUrl before running
param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_ID,
  [string]$SiteUrl = $env:PUBLIC_SITE_URL
)

if (-not $ProjectRef) { $ProjectRef = "YOUR_SUPABASE_PROJECT_REF" }
if (-not $SiteUrl) { $SiteUrl = "https://your-domain.example" }

Write-Host @"
请在 Supabase Dashboard 完成 Auth 配置：

项目: https://supabase.com/dashboard/project/$ProjectRef

Authentication → URL Configuration:
  Site URL:              $SiteUrl
  Redirect URLs (每行一个):
    $SiteUrl/**
    http://localhost:8080/**

若使用 Google 登录，在 Authentication → Providers → Google 配置 OAuth
（从 Google Cloud Console 复制 Client ID / Secret，回调 URL 填 Supabase 提供的）

"@
