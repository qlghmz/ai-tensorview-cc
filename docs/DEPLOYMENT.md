# Deployment guide

## Environment model

Three isolated layers:

| Layer | Staging | Production |
|-------|---------|------------|
| **Frontend** | Worker `ai-tensorview-staging` | Worker `ai-tensorview-cc` |
| **URL** | `*.workers.dev` or `staging.your-domain.com` | `your-domain.com` |
| **Database** | Separate Supabase project or local `supabase start` | Production Supabase project |
| **Secrets** | `.env.staging.local` | `.env.production.local` |

Never point staging and production at the same Supabase project if you test destructive flows (signup, payments, admin).

## Recommended workflow

```
feature branch → npm run dev (local)
              → npm run deploy:staging
              → npm run smoke:staging
              → merge to main
              → npm run deploy:production
              → npm run smoke:production
```

## First-time Cloudflare setup

```bash
npm install
npx wrangler login
```

Create env files:

```bash
cp .env.staging.example .env.staging.local
cp .env.production.example .env.production.local
```

Fill each file with **different** Supabase projects when possible.

## Deploy commands

```bash
# Staging (safe for experiments)
npm run deploy:staging

# Production (live users)
npm run deploy:production
```

Both commands:

1. Load env from `.env.{mode}.local`
2. `vite build --mode {mode}`
3. Patch `.output/server/wrangler.json` (worker name, routes)
4. `wrangler secret put` for Supabase + AI keys
5. `wrangler deploy`

## Custom domain (production)

1. Set in `.env.production.local`:
   ```
   CUSTOM_DOMAIN=ai.example.com
   CLOUDFLARE_ZONE_ID=your_zone_id
   WORKER_NAME=your-worker-name
   ```
2. Create DNS Edit token at Cloudflare → API Tokens.
3. Save token to `.cloudflare-dns-token` (one line, gitignored).
4. Run `npm run bind:domain`.

**Important:** Do not put `CLOUDFLARE_API_TOKEN` in `.env.local` — Wrangler will use it instead of OAuth and deploy may fail.

## Supabase auth URLs

After linking your project, update `supabase/config.toml`:

```toml
[auth]
site_url = "https://your-domain.com"
additional_redirect_urls = [
  "https://your-domain.com/**",
  "http://localhost:8080/**",
]
```

Push to hosted project:

```bash
npx supabase config push
```

For staging Supabase, add staging URLs to `additional_redirect_urls`.

## Local Supabase for staging

When you cannot create a second hosted project:

```bash
npx supabase start
npx supabase db reset   # applies migrations locally
```

Use keys from `supabase status` in `.env.staging.local`:

```
SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_URL=http://127.0.0.1:54321
# ... anon + service_role from supabase status
```

Deploy staging worker pointing at local DB only works if the worker can reach your machine — typically you use staging worker + **hosted staging Supabase**, or test locally with `npm run dev`.

## Smoke tests

```bash
npm run smoke:staging
npm run smoke:production
```

Override target URL:

```
SMOKE_TEST_URL=https://ai-tensorview-staging.account.workers.dev
```

## CI (GitHub Actions)

The repo includes `.github/workflows/ci.yml` — lint + build on push/PR. Deploy remains manual or add your own workflow with Cloudflare + Supabase secrets.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Deploy fails with API token error | Remove `CLOUDFLARE_API_TOKEN` from env files |
| Auth redirect loop | Check Supabase Site URL + redirect URLs |
| Staging hits production data | Use separate Supabase project or local instance |
| DNS not updating | Use `.cloudflare-dns-token` with Zone DNS Edit scope |
