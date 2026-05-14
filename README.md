# OpenCLA

TypeScript GitHub App for enforcing Contributor License Agreement coverage on pull requests.

## What It Does

- Verifies GitHub webhook signatures.
- Handles `pull_request` events and publishes a GitHub Check Run named `Contributor License Agreement`.
- Resolves the effective CLA from repository `CLA.md`, falling back to a bundled default template.
- Lets contributors sign with a minimal GitHub OAuth login.
- Supports corporate CLA agreements that cover active members of a GitHub organization.
- Uses Drizzle ORM with any Postgres-compatible database, including Neon.

## Stack

- Node.js + Fastify
- Drizzle ORM + Drizzle Kit
- Postgres-compatible database, recommended initial provider: Neon
- GitHub App installation auth and minimal OAuth login for signers
- Vitest

## Local Setup

1. Install dependencies.

   ```sh
   npm install
   ```

2. Create a Neon Postgres database.

   Copy the pooled connection string into `DATABASE_URL`. If Neon gives you a separate direct connection string, use that for `DATABASE_MIGRATION_URL`.

   ```env
   DATABASE_URL=postgresql://...
   DATABASE_MIGRATION_URL=postgresql://...
   ```

3. Copy `.env.example` to `.env`.

   ```sh
   cp .env.example .env
   ```

4. Start an ngrok tunnel for local GitHub webhooks.

   ```sh
   ngrok http 3000
   ```

   Use the `https://...ngrok-free.app` URL as `PUBLIC_APP_URL`.

   ```env
   PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app
   ```

5. Create a GitHub App for repository integration.

   Use these URLs:

   ```text
   Homepage URL:
   https://your-ngrok-url.ngrok-free.app

   Webhook URL:
   https://your-ngrok-url.ngrok-free.app/webhooks/github
   ```

   Generate a webhook secret and put the same value in GitHub and `.env`.

   ```sh
   openssl rand -hex 32
   ```

   ```env
   GITHUB_WEBHOOK_SECRET=...
   ```

   Subscribe to this webhook event:

   ```text
   Pull request
   ```

   Set repository permissions:

   ```text
   Checks: Read and write
   Contents: Read-only
   Issues: Read and write
   Pull requests: Read and write
   Metadata: Read-only
   ```

   Set organization permissions:

   ```text
   Members: Read-only
   ```

   After creating the app, copy these values into `.env`:

   ```env
   GITHUB_APP_ID=...
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   ```

   The GitHub App client values are used only as a fallback for signer auth. Personal signing should use the separate OAuth App below.

6. Create a separate GitHub OAuth App for signer login.

   This avoids the GitHub App user authorization screen that says "Act on your behalf" for normal personal CLA signing.

   ```text
   Application name:
   OpenCLA Sign In

   Homepage URL:
   https://your-ngrok-url.ngrok-free.app

   Authorization callback URL:
   https://your-ngrok-url.ngrok-free.app/auth/github/callback
   ```

   Copy the OAuth App credentials into `.env`.

   ```env
   GITHUB_OAUTH_CLIENT_ID=...
   GITHUB_OAUTH_CLIENT_SECRET=...
   ```

   The app requests no OAuth scopes for normal signing. It only uses `GET /user` to store the durable GitHub numeric user ID and login.

7. Set a session secret.

   ```sh
   openssl rand -hex 32
   ```

   ```env
   SESSION_SECRET=...
   ```

8. Run database migrations.

   ```sh
   npm run db:migrate
   ```

9. Start the app.

   ```sh
   npm run dev
   ```

10. Verify the public health endpoint.

   ```sh
   curl https://your-ngrok-url.ngrok-free.app/healthz
   ```

## GitHub App Settings

Configure the GitHub App with this webhook event:

- `pull_request`

Repository permissions:

- Checks: read/write
- Contents: read
- Pull requests: read/write
- Issues: read/write, for the explanatory CLA comment
- Metadata: read

Organization permissions:

- Members: read

The GitHub App handles repository installation, webhooks, check runs, reading `CLA.md`, and PR comments.

## OAuth App Settings

Create a separate GitHub OAuth App for signer login. The callback URL is:

```text
https://your-public-url/auth/github/callback
```

Set these values in `.env`:

```env
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
```

The OAuth App should not request any scopes. This keeps the contributor prompt limited to identity verification rather than GitHub App user authorization.

## End-To-End PR Test

1. Install the GitHub App on a test repository.
2. Open or update a pull request.
3. Confirm the app receives `POST /webhooks/github`.
4. Confirm the PR gets a `Contributor License Agreement` check.
5. If the contributor has not signed, confirm the check fails and the app comments with a signing link.
6. Open the signing link in an incognito window.
7. Authorize the OAuth App, review the CLA, and click `I agree and sign personally`.
8. Confirm the app rechecks the PR and updates the CLA check to success.

For local retesting on an existing PR, push an empty commit to retrigger `pull_request.synchronize`:

```sh
git commit --allow-empty -m "Retest CLA check"
git push
```

## Corporate CLA Notes

Corporate signing currently requires the signer to authenticate with GitHub and prove they are an owner of the selected organization. The app stores a corporate agreement for the CLA version and checks contributors against GitHub organization membership.

For production, consider adding a separate corporate authorization path that clearly explains the extra org access needed before requesting it.

## Deploying To Railway With Neon

Railway can host the Node service while Neon hosts Postgres.

1. Create a Neon database and copy the pooled connection string into `DATABASE_URL`.
2. Use a direct Neon connection string for `DATABASE_MIGRATION_URL` if your Neon setup separates pooled runtime connections from migration connections.
3. Create a Railway service from this repository.
4. Add all environment variables from `.env.example` in Railway.
5. Run migrations with `npm run db:migrate`.
6. Configure the GitHub App webhook URL and OAuth App callback URL to the Railway service URL.

The app also includes a `Dockerfile`, so it can move to another Node/container host without changing the database layer.

## Troubleshooting

- If PR comments fail with `Resource not accessible by integration`, update the GitHub App permissions to `Issues: Read and write` and `Pull requests: Read and write`, then reinstall or approve the updated app permissions on the repository.
- If the signer auth screen says `Act on your behalf`, the app is using the GitHub App client ID. Create a separate OAuth App and set `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`.
- If GitHub webhooks do not arrive locally, verify ngrok is still running and that `PUBLIC_APP_URL`, the GitHub App webhook URL, and the OAuth callback URL all use the current ngrok hostname.
- If the check does not update after signing, push an empty commit to the PR branch or inspect the local server logs for the `/webhooks/github` and `/sign/personal` requests.

## Scripts

- `npm run dev`: start the development server with `tsx`.
- `npm run build`: compile TypeScript to `dist`.
- `npm start`: run the compiled server.
- `npm run typecheck`: run TypeScript without emitting files.
- `npm test`: run Vitest.
- `npm run db:generate`: generate Drizzle migrations from `src/db/schema.ts`.
- `npm run db:migrate`: apply Drizzle migrations.
