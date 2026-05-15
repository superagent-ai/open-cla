CLA templates define the legal text and version OpenCLA enforces. The admin app lets you maintain **global** templates and choose which managed version a repository uses.

## How templates fit in

OpenCLA resolves the active CLA for a repository from your managed template configuration (and related storage on the API). That resolution yields a **CLA document** and a **version hash** that drives both checks and signing.

## Global templates

Global templates are created and listed under the **Templates** area of the admin app (`/templates`). They are shared definitions you can attach to multiple repositories.

## Creating a template

1. Sign in to the admin app with a GitHub account that has access to manage templates (per your deployment).
2. Open **Templates** and choose to create a new template.
3. Edit the body (Markdown) and save. Each saved version is immutable from a compliance perspective: updates create new **versions** rather than silently rewriting history.

Use clear titles so admins can recognize versions in the dashboard.

## Selecting a template for a repository

1. From the main dashboard, select the installed **repository** you want to configure.
2. Pick the template version that should apply. The API persists that selection for future check runs.

Repositories without a selection may fall back to deployment defaults depending on your `DEFAULT_CLA_TEMPLATE_NAME` configuration—confirm with your operator for hosted vs self-hosted behavior.

## Versions and the CLA hash

Every template version has a **hash** derived from its content. Personal signatures and corporate agreements are always tied to a specific **CLA document** + **hash**:

- If you roll out new CLA text, contributors are covered only after they sign (or the org re-signs corporately) for that **new** hash.
- Old signatures remain associated with previous hashes for auditability.

Plan communications when you adopt a new version so teams know to re-sign.

## Admin access

Changing templates or repository selection requires **GitHub admin** permission on that **repository** (as enforced by the API on each request). This prevents someone without repo admin rights from altering CLA requirements for a project they do not control.
