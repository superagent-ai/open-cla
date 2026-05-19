export type GitHubInstallationAccount = {
  accountId: string;
  accountLogin: string;
  accountType: string;
};

type GitHubOrgMembership = {
  role?: string;
  state?: string;
};

type GitHubRepositoryPermissions = {
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
  };
};

export async function githubUserFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "superagent-cla"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${path} with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function isActiveOrgOwner(token: string, orgLogin: string): Promise<boolean> {
  try {
    const membership = await githubUserFetch<GitHubOrgMembership>(
      token,
      `/user/memberships/orgs/${encodeURIComponent(orgLogin)}`
    );
    return membership.state === "active" && membership.role === "admin";
  } catch {
    return false;
  }
}

export async function hasRepositoryAdminPermission(params: {
  accessToken: string;
  githubUserId: string;
  owner: string;
  name: string;
  installation?: GitHubInstallationAccount | null;
}): Promise<boolean> {
  if (
    params.installation?.accountType === "User" &&
    params.installation.accountId === params.githubUserId
  ) {
    return true;
  }

  if (
    params.installation?.accountType === "Organization" &&
    params.installation.accountLogin === params.owner &&
    (await isActiveOrgOwner(params.accessToken, params.owner))
  ) {
    return true;
  }

  try {
    const repository = await githubUserFetch<GitHubRepositoryPermissions>(
      params.accessToken,
      `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.name)}`
    );
    return repository.permissions?.admin === true;
  } catch {
    return false;
  }
}

export async function assertActiveOrgOwner(token: string, orgLogin: string): Promise<void> {
  const isOwner = await isActiveOrgOwner(token, orgLogin);
  if (!isOwner) {
    throw new Error("Corporate CLA signing requires active GitHub organization owner access");
  }
}
