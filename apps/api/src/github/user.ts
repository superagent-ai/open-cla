export type GitHubInstallationAccount = {
  accountId: string;
  accountLogin: string;
  accountType: string;
};

export type RepositoryAdminPermissionCache = {
  isActiveOrgOwner: (orgLogin: string) => Promise<boolean>;
  hasRepoAdminPermission: (owner: string, name: string) => Promise<boolean>;
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

export function createRepositoryAdminPermissionCache(
  accessToken: string
): RepositoryAdminPermissionCache {
  const orgOwnerResults = new Map<string, Promise<boolean>>();
  const repoAdminResults = new Map<string, Promise<boolean>>();

  return {
    isActiveOrgOwner(orgLogin) {
      const cached = orgOwnerResults.get(orgLogin);
      if (cached) {
        return cached;
      }

      const result = isActiveOrgOwner(accessToken, orgLogin);
      orgOwnerResults.set(orgLogin, result);
      return result;
    },
    hasRepoAdminPermission(owner, name) {
      const key = `${owner}/${name}`;
      const cached = repoAdminResults.get(key);
      if (cached) {
        return cached;
      }

      const result = fetchRepoAdminPermission(accessToken, owner, name);
      repoAdminResults.set(key, result);
      return result;
    }
  };
}

export async function hasRepositoryAdminPermission(params: {
  accessToken: string;
  githubUserId: string;
  owner: string;
  name: string;
  installation?: GitHubInstallationAccount | null;
  cache?: RepositoryAdminPermissionCache;
}): Promise<boolean> {
  const cache = params.cache ?? createRepositoryAdminPermissionCache(params.accessToken);

  if (
    params.installation?.accountType === "User" &&
    params.installation.accountId === params.githubUserId
  ) {
    return true;
  }

  if (
    params.installation?.accountType === "Organization" &&
    params.installation.accountLogin === params.owner &&
    (await cache.isActiveOrgOwner(params.owner))
  ) {
    return true;
  }

  return cache.hasRepoAdminPermission(params.owner, params.name);
}

async function fetchRepoAdminPermission(
  token: string,
  owner: string,
  name: string
): Promise<boolean> {
  try {
    const repository = await githubUserFetch<GitHubRepositoryPermissions>(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
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
