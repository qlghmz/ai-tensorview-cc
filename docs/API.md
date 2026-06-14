# REST API

## Generate UI (v1)

**POST** `/api/v1/generate`

Creates or updates a project preview from a natural language prompt (same engine as the web editor).

### Authentication

Either:

- **Bearer token** — Supabase session JWT (`Authorization: Bearer <access_token>`)
- **API Key** — Create in Settings → API Keys, then header `X-API-Key: tv_...`

### Request body

```json
{
  "projectId": "uuid-of-your-project",
  "prompt": "做一个深色主题的 SaaS 落地页",
  "styleId": "minimal-saas"
}
```

Optional `styleId`: `minimal-saas` | `dark-dev` | `warm-commerce` | `corporate` | `playful`

### Response

```json
{
  "ok": true,
  "reply": "...",
  "sandpack": { "routes": [...], "files": {...} },
  "finishReason": "stop"
}
```

### Errors

| Status | Meaning |
|--------|---------|
| 401 | Invalid auth |
| 402 | Insufficient credits |
| 503 | AI not configured on server |

### Example (curl)

```bash
curl -X POST https://ai.tensorview.cc/api/v1/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tv_your_key_here" \
  -d '{"projectId":"YOUR_PROJECT_UUID","prompt":"Portfolio site for a designer"}'
```

## Streaming API (web editor)

**POST** `/api/ai/stream` — NDJSON stream, same auth as above.

See [GENERATION.md](./GENERATION.md) for architecture details.
