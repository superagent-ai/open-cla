This page describes how contributors become “covered” for the CLA check. It reflects OpenCLA’s current signing and coverage rules.

## Before you sign

1. Follow the link from the failed **Contributor License Agreement** check (or your team’s instructions). You must be able to sign in with **GitHub OAuth** on the signing host.
2. The page shows the **exact CLA text and version** (hash) you are agreeing to for that repository.

If GitHub reports the repository is unknown, open or update a pull request first so the installation has seen the repo.

## Personal CLA

**Who:** any contributor with a GitHub account.

**What happens:** you submit the personal signing form. OpenCLA records a **personal signature** for your GitHub user id and the **current CLA version hash**. You can re-sign the same version if needed; updates refresh the stored metadata.

**When to use it:** default for individual contributors, contractors, or anyone not relying on a corporate umbrella agreement.

## Corporate organization CLA

**Who:** only users who are **active organization owners** (`admin` role) of the GitHub organization they name on the form.

**What happens:** the org owner submits corporate signing with the **organization login**. OpenCLA stores a **corporate agreement** keyed by **organization** and **CLA version hash**, along with who authorized it.

**When to use it:** your employer or org wants one signature to cover multiple contributors who are **members of that organization**.

> Corporate signing is rejected if the GitHub user is not an active org owner for the organization they entered.

## How coverage is decided

For each contributor on a pull request, OpenCLA asks:

1. Is there a **personal signature** for this user and this **CLA version hash**? If yes, they are covered (**personal**).
2. Otherwise, is there a **corporate agreement** for this **CLA version hash** such that the contributor is an **active member** of that organization? If yes, they are covered (**corporate**).
3. If neither applies, the check lists them as missing coverage.

## Organization membership

Corporate coverage depends on accurate membership. OpenCLA caches membership when processing pull requests so it can evaluate org coverage efficiently.

If someone recently joined or left an organization, the next pull request activity helps refresh that picture; if coverage looks stale, pushing a commit to the PR or opening a new PR triggers another evaluation path.

## If the check still fails

- Confirm everyone who needs **personal** coverage has completed signing for the **current** template version.
- For **corporate** coverage, confirm an org owner signed for the correct **org** and **CLA hash**, and that the contributor is a **member** of that org.
- Verify the GitHub App install includes the repository and has the **Members: read** organization permission for org-wide scenarios.

## Retest the check on an open PR

After signing, you can nudge GitHub to re-run checks by pushing a new commit. For a quick retest without content changes:

```bash
git commit --allow-empty -m "Retest CLA check"
git push
```

Your team may also re-run checks from the GitHub UI depending on repository settings.
