CLA templates define the legal text and version OpenCLA enforces. The admin app lets you maintain **global** templates and choose which managed version a repository uses.

## How templates fit in

OpenCLA resolves the active CLA for a repository from your managed template configuration (and related storage on the API). That resolution yields a **CLA document** and a **version hash** that drives both checks and signing.

## Global templates

Global templates are created and listed under the **Templates** area of the admin app (`/templates`). They are shared definitions you can attach to multiple repositories.

## Built-in templates

OpenCLA includes bundled starter templates for common contribution policies:

- **Standard Contributor License Agreement** (`standard-combined-v1`): balanced default for personal and organization signing.
- **Inbound = Outbound Contribution Agreement** (`inbound-outbound-v1`): lightweight policy that uses the project's outbound license for inbound contributions.
- **Copyright-Only Contributor License Agreement** (`copyright-only-v1`): copyright grant without an express patent grant.
- **Patent Grant Contributor License Agreement** (`patent-grant-v1`): copyright and patent grants with defensive termination.
- **Organization Contributor License Agreement** (`organization-covered-v1`): organization owner signing for authorized contributors.
- **Documentation and Content Contribution Agreement** (`docs-content-v1`): non-code content, docs, websites, tutorials, and media.
- **Experimental and Research Contribution Agreement** (`experimental-research-v1`): notebooks, datasets, models, benchmarks, and research artifacts.
- **Individual Contributor License Agreement** (`individual-v1`): individual-only CLA retained for compatibility with older deployments.

These templates are useful starting points, not legal advice. Review the selected template with counsel before relying on it in production.

## Creating a template

1. Sign in to the admin app with a GitHub account that has access to manage templates (per your deployment).
2. Open **Templates** and choose to create a new template.
3. Edit the body (Markdown) and save. Each saved version is immutable from a compliance perspective: updates create new **versions** rather than silently rewriting history.

Use clear titles so admins can recognize versions in the dashboard.

## Selecting a template for a repository

1. From the main dashboard, select the installed **repository** you want to configure.
2. Pick the template version that should apply. The API persists that selection for future check runs.

Repositories without a repository `CLA.md` or managed template selection fall back to the template named by `DEFAULT_CLA_TEMPLATE_NAME`. New deployments default to `standard-combined-v1`.

## Versions and the CLA hash

Every template version has a **hash** derived from its content. Personal signatures and corporate agreements are always tied to a specific **CLA document** + **hash**:

- If you roll out new CLA text, contributors are covered only after they sign (or the org re-signs corporately) for that **new** hash.
- Old signatures remain associated with previous hashes for auditability.

Plan communications when you adopt a new version so teams know to re-sign.

## Admin access

Changing templates or repository selection requires **GitHub admin** permission on that **repository** (as enforced by the API on each request). This prevents someone without repo admin rights from altering CLA requirements for a project they do not control.
