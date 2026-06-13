# AI UI generation pipeline

This document explains how natural language becomes a runnable React preview.

## Overview

1. User opens `/project/:projectId` and sends a prompt.
2. Frontend POSTs to `/api/ai/stream` with `{ projectId, prompt }`.
3. Server validates auth, checks credits, loads chat history from Supabase.
4. AI returns a **Lovable bundle** — JSON with `routes` and `files` (React source strings).
5. Server parses, validates, saves messages + Sandpack snapshot to the database.
6. Client receives an NDJSON stream and updates the Sandpack preview.

## Lovable bundle format

The model must output a single Markdown fence tagged `lovable` containing JSON:

```json
{
  "routes": [
    { "path": "/", "label": "首页" },
    { "path": "/about", "label": "关于" }
  ],
  "files": {
    "/App.tsx": "import { Routes, Route, Link } from 'react-router-dom';\n...",
    "/pages/Home.tsx": "export default function Home() { ... }",
    "/styles.css": "body { margin: 0; ... }"
  }
}
```

Rules enforced by the system prompt (`src/lib/ai-generate-shared.ts`):

- Keys in `files` are absolute paths (`/App.tsx`, `/pages/Home.tsx`).
- Must include `/App.tsx` with `react-router-dom` routes matching `routes`.
- No `package.json`, Vite config, or outer `BrowserRouter` (host injects these).
- Tailwind classes OK (CDN injected in Sandpack).
- Optional `/api/*.ts` handlers for serverless backends when user asks.

Parsing lives in `src/lib/lovable-bundle.ts`: extract fence → JSON parse → Zod validate → patch React imports.

## Segmented generation

Large sites are generated in segments (`generateSegmentedLovableBundle`) to stay within token limits:

1. Plan routes and page names.
2. Generate each page file in separate AI calls if needed.
3. Merge into one bundle before preview.

If parsing fails, a fallback path retries with a simplified prompt.

## Streaming API

`src/routes/api.ai.stream.ts`:

- Auth via Supabase session cookie / bearer token.
- Refills daily credits (`refill_user_credits` RPC).
- Returns `application/x-ndjson` events:

| Event type | Meaning |
|------------|---------|
| `ready` | Stream started |
| `status` | Progress message (heartbeat every 15s) |
| `preview` | Sandpack payload ready |
| `final` | Complete reply + sandpack |
| `error` | Failure message |

Non-admin users consume 1 credit per successful generation.

## Sandpack preview

`src/components/lovable/LovableSandpack.tsx` (client-only via `ClientLovableSandpack`):

- Injects React 19, react-router-dom, Tailwind CDN.
- Wraps app in `MemoryRouter` (routes from bundle).
- Maps `files` dict to Sandpack virtual filesystem.

The project route sets `ssr: false` because Sandpack requires browser APIs.

## Persistence

After generation, `persistGenerationResult` saves:

- Assistant message (markdown reply)
- User message (prompt)
- `projects.sandpack` JSON column (files + routes for reload)

## Backend recipes (optional)

When the user needs forms, webhooks, or third-party APIs, `detectBackendNeeds` in `src/lib/backend-recipes.ts` can trigger a planning step before code generation. Confirmed options are injected into the prompt.

## Customizing the AI

Edit `SYSTEM_PROMPT` in `src/lib/ai-generate-shared.ts` or switch provider in `src/lib/ai-config.ts` (currently DashScope-compatible OpenAI API).

Environment:

```
DASHSCOPE_API_KEY=sk-...
DASHSCOPE_MODEL=qwen-plus
```

## Extending

- **New UI patterns**: adjust system prompt constraints (line limits, allowed imports).
- **Different preview runtime**: replace Sandpack mapping in `lovable-bundle.ts`.
- **Other LLMs**: implement `chatCompletionNonStream` / streaming in `ai-config.ts`.
