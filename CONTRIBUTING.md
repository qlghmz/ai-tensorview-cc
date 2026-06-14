# Contributing

Thanks for contributing to TensorView Builder!

## Development

```bash
git clone https://github.com/qlghmz/ai-tensorview-cc.git
cd ai-tensorview-cc
npm install
cp .env.example .env.local
npm run dev
```

## Pull requests

1. Fork and create a feature branch
2. Keep changes focused; match existing code style
3. Run `npm run lint` and `npm run build`
4. Open a PR against `main` with a clear description

## Database changes

Add migrations under `supabase/migrations/` and update `src/integrations/supabase/types.ts` if needed.

## Security

Report vulnerabilities privately via GitHub Security Advisories or email the maintainer — do not open public issues for exploits.
