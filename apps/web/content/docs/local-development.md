This section condenses operator setup from the repository README for teams running their own OpenCLA stack.

## Repository layout

- `apps/api` — Fastify API, GitHub webhooks, OAuth, signing pages, database schema
- `apps/web` — Next.js admin UI
- `packages/shared` — shared API contracts

## Environment variables

Copy `apps/api/.env.example` to `.env` at the repo root or under `apps/api`. At minimum you need:

- `DATABASE_URL` and `DATABASE_MIGRATION_URL` for Postgres
- GitHub App fields: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
- OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` (see README for the split between app user tokens and OAuth app used for sign-in)
- `SESSION_SECRET` (long random string)
- `PUBLIC_APP_URL` — public base URL of the **API** (used for webhooks and OAuth callbacks)
- `ADMIN_WEB_URL` — origin of the admin Next.js app

For production-style deployments, the web app uses:

- `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WEB_URL`

## GitHub App and webhook

Point the GitHub App **webhook** at:

```text
https://<your-api-host>/webhooks/github
```

Subscribe to `pull_request`, `installation`, and `installation_repositories`. Configure repository and organization permissions exactly as in the [Install the GitHub App](/docs?doc=install-github-app) doc.

## GitHub OAuth for sign-in

Create a **GitHub OAuth App** (separate from the GitHub App) for contributor/admin login. Per the README, set:

- **Homepage URL:** your admin web origin (for example `http://localhost:3001` locally)
- **Authorization callback URL:** `https://<your-api-host>/auth/github/callback`

The OAuth App requests **`read:org`** by default (`GITHUB_OAUTH_SCOPES`) so org owners can list private organization repositories in the admin UI. Set `GITHUB_OAUTH_SCOPES=` to request no scopes. After changing scopes, sign out and sign in again so GitHub re-authorizes.

## Database

1. Create a Postgres database.
2. Run migrations: `pnpm run db:migrate` from the repository root.

## Running the stack

From the repo root:

```bash
pnpm install
pnpm run dev:api    # API on port 3000
pnpm run dev:web    # admin UI on port 3001
```

For local GitHub integration you typically run an `ngrok` (or similar) tunnel to port `3000` and set `PUBLIC_APP_URL` to that HTTPS URL so GitHub can deliver webhooks.
