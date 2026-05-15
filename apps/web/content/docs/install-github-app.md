OpenCLA’s GitHub App delivers webhooks to your **API** deployment. The admin UI is separate; installs and checks always depend on the app being configured correctly on GitHub.

## Where the app runs

- **API / GitHub App backend:** receives `POST /webhooks/github`, serves signing routes such as `/sign`, and performs OAuth for signing sessions.
- **Admin web app:** dashboard at your configured web origin (for example `NEXT_PUBLIC_WEB_URL` when self-hosted).

Use your operator-provided URLs; self-hosters follow the same split as in the repository README.

## GitHub App configuration

In GitHub’s GitHub App settings:

1. Set **Webhook URL** to your API’s GitHub webhook endpoint, for example `https://<api-host>/webhooks/github`.
2. Subscribe to events:
   - `pull_request`
   - `installation`
   - `installation_repositories`

These events let OpenCLA react to PRs and to repositories added or removed from the installation.

## Repository permissions

Grant the app at least:

- **Checks:** read and write (to publish the Contributor License Agreement check)
- **Contents:** read
- **Issues:** read and write
- **Pull requests:** read and write
- **Metadata:** read

Exact labels may vary slightly in the GitHub UI; mirror the list in the project README.

## Organization permission

Enable organization permission:

- **Members:** read

This allows OpenCLA to reason about **organization membership** when evaluating **corporate** CLA coverage for contributors. Without it, corporate coverage for org members may not work as intended.

## Installing on personal vs organization accounts

- **Personal account:** install the app on selected repositories under your user. Use this when only your own repos need CLAs.
- **GitHub organization:** install at the **organization** level and choose all repositories or a subset. This is the usual model for company-owned codebases and aligns with **corporate** agreements signed by an **org owner**.

You can adjust repository access later; `installation_repositories` keeps OpenCLA in sync.

## After installation

1. Push or open a **pull request** so the app learns the repository and can open checks.
2. In the admin UI, sign in with GitHub and select the repo to attach a template if your workflow uses managed templates.

If a contributor sees “repository has not been seen by the CLA app yet,” open or update a PR first so the installation is associated with that repo in OpenCLA.

## Contributor signing URL

The signing experience is served from the **API** host (for example `https://<api-host>/sign?owner=...&repo=...` with optional `pull` and `sha` query parameters). Check run details and your deployment docs should point contributors at that origin.

When self-hosting, ensure `PUBLIC_APP_URL` / OAuth `returnTo` configuration matches so sign-in returns people to the correct signing URL.
