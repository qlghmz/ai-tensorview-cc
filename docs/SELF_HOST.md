# 本地开发（Docker Compose）

可选：用 Docker 跑 **Ollama** 本地模型，主应用仍建议 `npm run dev` 在宿主机运行（与 Supabase 云端或 `supabase start` 配合）。

```bash
docker compose up -d ollama
# 拉取模型（首次）
docker compose exec ollama ollama pull llama3.2
```

在 `.env.local` 中：

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

然后 `npm run dev`。

## 完整自托管清单

1. Fork 本仓库，`npm install`
2. 创建 Supabase 项目 → `npx supabase link` → `npx supabase db push`
3. 配置 `.env.local`（见 `.env.example`）
4. （可选）`docker compose up -d ollama` 本地 AI
5. `npm run dev` 或 `npm run deploy:production`

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)。
