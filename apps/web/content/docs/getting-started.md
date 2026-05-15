OpenCLA is a GitHub App that enforces **Contributor License Agreement (CLA)** coverage on pull requests. It publishes a GitHub Check named **Contributor License Agreement** and guides contributors through signing when they are not yet covered.

## What OpenCLA does

- Verifies incoming GitHub webhooks and reacts to pull request activity.
- Resolves which CLA text applies to a repository (managed template workflow in the admin UI).
- Evaluates every contributor on a pull request against **personal signatures** and **corporate agreements** for the active CLA version.
- Offers a signing flow (hosted on your **API** deployment) where contributors authenticate with GitHub OAuth.

Repository admins manage templates and see signature activity from the **admin web** app; contributors interact with checks and the signing pages.

## The CLA check on pull requests

When someone opens or updates a pull request, OpenCLA computes whether each contributor is covered for the **current CLA document version** (identified by a content hash). If anyone is missing coverage, the check fails and typically links contributors to the signing experience.

After someone signs (or is covered by a valid corporate agreement for their org membership), pushing a new commit or re-running the check path updates the result.

## Personal and organization CLAs

- **Personal CLA:** the individual contributor signs for themselves. The signature is stored per GitHub user and CLA version.
- **Corporate (organization) CLA:** an **organization owner** signs on behalf of a GitHub organization for a given CLA version. Active members of that organization can then be covered by that agreement without a personal signature, subject to membership checks.

See [Personal and org CLAs](/docs?doc=signing-personal-vs-corporate) for details on eligibility and how coverage is evaluated.

## Who does what

| Role | Typical tasks |
| --- | --- |
| **Org or repo admin** | Install the GitHub App, choose CLA templates, review signatures |
| **Contributor** | Complete personal signing or rely on corporate coverage |
| **Org owner** (corporate path) | Sign the corporate agreement for the organization |

Admin capabilities in the UI are not global: the backend checks that the signed-in GitHub user has **admin** permission on the **installed repository** being managed.

## End-to-end flow

1. Configure the GitHub App (webhook URL, events, permissions) and install it on the repositories you want to protect.
2. In the admin app, ensure a template exists and assign it to the repository if needed.
3. Open or update a pull request; confirm the **Contributor License Agreement** check appears.
4. If the check fails, contributors follow the signing link, choose personal or (if eligible) corporate signing.
5. After coverage is complete, the check should pass on the next relevant update.

## Next steps

- [Install the GitHub App](/docs?doc=install-github-app)
- [CLA templates](/docs?doc=templates)
- [Personal and organization CLAs](/docs?doc=signing-personal-vs-corporate)
