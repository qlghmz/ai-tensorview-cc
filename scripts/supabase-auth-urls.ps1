# 在新 Supabase 项目配置 Auth 回调 URL（需浏览器手动确认时参考）
Write-Host @"
请在 Supabase Dashboard 完成 Auth 配置：

项目: https://supabase.com/dashboard/project/vyzfoptwncwqbphkzrfr

Authentication → URL Configuration:
  Site URL:              https://ai.tensorview.cc
  Redirect URLs (每行一个):
    https://ai.tensorview.cc/**
    http://localhost:8080/**

若使用 Google 登录，在 Authentication → Providers → Google 配置 OAuth
（从 Google Cloud Console 复制 Client ID / Secret，回调 URL 填 Supabase 提供的）

"@
