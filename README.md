# OpenCLA

TypeScript monorepo for a GitHub App that enforces Contributor License Agreement coverage and an admin UI for managing CLA templates and signatures.

## Workspace Layout

- `apps/api`: Fastify API, GitHub App webhooks, OAuth, signing pages, Drizzle schema, and migrations.
- `apps/web`: Next.js admin app using Shadcn-style components.
- `packages/shared`: shared Zod schemas and TypeScript API contracts.

## What It Does

- Verifies GitHub webhook signatures.
- Handles `pull_request` events and publishes a GitHub Check Run named `Contributor License Agreement`.
- Lets contributors sign with GitHub OAuth.
- Lets repository admins select a managed CLA template, upload immutable template versions, and view signatures/checks.
- Supports corporate CLA agreements that cover active members of a GitHub organization.
- Uses Drizzle ORM with any Postgres-compatible database, including Neon.

## Local Setup

1. Install dependencies.

   ```sh
   npm install
   ```

2. Copy the API environment template.

   ```sh
   cp apps/api/.env.example .env
   ```

   The API loads `.env` from the repository root or `apps/api/.env`.

3. Create a Postgres database and set connection strings.

   ```env
   DATABASE_URL=postgresql://...
   DATABASE_MIGRATION_URL=postgresql://...
   ```

4. Start an ngrok tunnel for local GitHub webhooks.

   ```sh
   ngrok http 3000
   ```

   Use the tunnel URL as `PUBLIC_APP_URL`. The admin app runs locally on port `3001`.

   ```env
   PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app
   ADMIN_WEB_URL=http://localhost:3001
   ```

5. Create a GitHub App.

   ```text
   Homepage URL:
   https://your-ngrok-url.ngrok-free.app

   Webhook URL:
   https://your-ngrok-url.ngrok-free.app/webhooks/github
   ```

   Subscribe to `pull_request` and configure repository permissions:

   ```text
   Checks: read/write
   Contents: read
   Issues: read/write
   Pull requests: read/write
   Metadata: read
   ```

   Configure organization permission:

   ```text
   Members: read
   ```

6. Create a separate GitHub OAuth App for signer/admin login.

   ```text
   Homepage URL:
   http://localhost:3001

   Authorization callback URL:
   https://your-ngrok-url.ngrok-free.app/auth/github/callback
   ```

   The OAuth App requests no scopes. The backend uses OAuth only for identity, then verifies admin rights per selected installed repository.

7. Set GitHub and session environment values.

   ```env
   GITHUB_APP_ID=...
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   GITHUB_WEBHOOK_SECRET=...
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   GITHUB_OAUTH_CLIENT_ID=...
   GITHUB_OAUTH_CLIENT_SECRET=...
   SESSION_SECRET=replace-with-at-least-32-characters
   ```

8. Run migrations.

   ```sh
   npm run db:migrate
   ```

9. Start both apps in separate terminals.

   ```sh
   npm run dev:api
   npm run dev:web
   ```

10. Visit the admin UI.

   ```text
   http://localhost:3001
   ```

## Admin Auth Model

GitHub OAuth establishes the user identity and stores an HTTP-only signed session cookie. Admin privileges are not global. Every admin API call includes a repository context, and `apps/api` verifies the logged-in GitHub user has `admin` permission on that installed repository before allowing template or signature access.

This keeps multi-account behavior explicit: one GitHub user can manage multiple orgs, personal accounts, and installations, but the backend authorizes each requested repository independently.

## Scripts

- `npm run dev:api`: build shared contracts and start the Fastify API on port `3000`.
- `npm run dev:web`: build shared contracts and start the Next.js admin app on port `3001`.
- `npm run build`: build shared contracts, API, and web app.
- `npm run typecheck`: typecheck all workspaces.
- `npm test`: build shared contracts and run API tests.
- `npm run db:generate`: generate Drizzle migrations for `apps/api`.
- `npm run db:migrate`: apply Drizzle migrations for `apps/api`.

## Deployment

The API remains the GitHub webhook and signing trust boundary. Build the API container from the repository root:

```sh
docker build -f apps/api/Dockerfile .
```

Deploy `apps/web` as a normal Next.js app with:

```env
API_BASE_URL=https://your-api.example.com
NEXT_PUBLIC_API_BASE_URL=https://your-api.example.com
NEXT_PUBLIC_WEB_URL=https://your-admin.example.com
```

Set `ADMIN_WEB_URL` on the API to the deployed admin origin so OAuth callbacks can safely return to the UI.

## End-To-End PR Test

1. Install the GitHub App on a test repository.
2. Open or update a pull request.
3. Confirm the API receives `POST /webhooks/github`.
4. Confirm the PR gets a `Contributor License Agreement` check.
5. If a contributor has not signed, confirm the check fails and links to the signing flow.
6. Sign in with GitHub, sign personally or corporately, and confirm the check updates to success.

For local retesting on an existing PR, push an empty commit:

```sh
git commit --allow-empty -m "Retest CLA check"
git push
```
