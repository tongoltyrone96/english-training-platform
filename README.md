# English Training Platform

An internal team website for English speaking practice and weekly tests. Phases 1–6 and the core Phase 7 security code are implemented. It covers authentication, content/DOCX management, Training, the real evaluation providers, the weekly Test, team charts and rankings, user and invitation management, and audit logging.

## Running locally

Node.js 22+ and PostgreSQL are required.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

The current development PC has a dedicated PostgreSQL 18 cluster for this project. After a reboot, start it in this order:

```bash
export PATH="$HOME/.local/lib/node-v22.19.0-linux-x64/bin:$PATH"
npm run db:start
npm run dev
```

Linux Node.js 22 is installed at the user-local path above. Adding the `export` line to `~/.bashrc` in WSL saves you from typing it in every new terminal.

Use `npm run db:status` and `npm run db:stop` to check on or shut down the database. The dedicated database listens on `127.0.0.1:55432` only and uses SCRAM authentication. Its data files live under `.local/share/english-training-postgres` in the Linux user's home directory and are not part of the source repository.

Set `INITIAL_INVITATION_CODE` to at least 8 characters. Only the first person to sign up with an email that exactly matches `INITIAL_ADMIN_EMAIL` becomes an ADMIN.

Running locally over HTTP uses `AUTH_SECURE_COOKIES=false`. When deploying over HTTPS you must switch to `AUTH_SECURE_COOKIES=true`.
When connecting from Windows via the WSL IP, set `AUTH_URL` to the same address you use in the browser.

To walk through the Training UI flow before the real evaluation integration is wired up, you can set `EVALUATION_MODE=mock`, but only in a local environment. That mode does not evaluate audio at all — it returns an explicit mock result — so it must never be used in production.

## Configuring the real evaluation

- `GROQ_API_KEY`: an API key issued in the Groq Console
- `GROQ_WHISPER_MODEL`: defaults to `whisper-large-v3-turbo` (use `whisper-large-v3` when accuracy matters more)
- `GROQ_LANGUAGE_MODEL`: defaults to `openai/gpt-oss-20b` (supports Structured Outputs)
- `EVALUATION_MODE=real`: use the real Groq speech-recognition and sentence-evaluation providers

Browser audio is received into server memory and then converted to WAV in a temporary directory. The converted file is deleted immediately on both success and failure, and no audio or URL is stored in the database, in object storage, or in the logs.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:e2e
npm run build
```

## Current verification results

- Prisma Client generation and schema validation: passing
- TypeScript type-check: passing
- ESLint: passing with no errors or warnings
- Vitest: 6 files, 15 tests passing
- PostgreSQL integration: 1 file, 2 database constraint tests passing
- Playwright E2E: 3 scenarios written — authentication, invalid invitation code, and admin RBAC
- Next.js production build: passing (`--webpack`)
- PostgreSQL 18 migration and seed applied: passing
- Groq speech recognition and sentence evaluation integrated

17 unit and integration tests pass in total. A runtime smoke test confirmed that `/sign-in` returns HTTP 200 and that an unauthenticated `/dashboard` request gets an HTTP 307 redirect to `/sign-in`. Running Playwright requires installing the WSL browser libraries once with `sudo npx playwright install-deps chromium`.

The default Next.js Turbopack build currently fails in this isolated environment because the CSS worker cannot open an internal port. The same source was verified with a webpack production build instead. `npm audit --omit=dev` reports 3 high-severity `deepmerge-ts` vulnerabilities coming from the Prisma CLI, but the suggested automatic fix forces Prisma down to an older version, so it was not applied. That path is a migration tool rather than the production runtime, and it should be revisited when Prisma is updated.

For the full set of phases and the technical decisions behind them, see [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

For the Vercel repository layout and the actual deployment steps, see [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md).

## Pre-deployment checklist

- Run `npx prisma migrate deploy` against the managed PostgreSQL instance
- Set the production `AUTH_SECRET`, the admin email, and the operating time zone
- Set the Groq key and model IDs, then validate against a dataset of real correct answers, accepted paraphrases, silence, and noise
- Confirm a Node.js runtime that can run ffmpeg and a 60-second request timeout
- Configure HTTPS, a trusted `x-forwarded-for` from the reverse proxy, backups, and log retention
- Verify the Playwright E2E suite and microphone permissions on a real mobile browser
