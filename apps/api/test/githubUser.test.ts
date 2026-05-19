import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRepositoryAdminPermissionCache,
  hasRepositoryAdminPermission,
  isActiveOrgOwner
} from "../src/github/user.js";

describe("github user permissions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("grants admin access for personal installation owners", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await hasRepositoryAdminPermission({
      accessToken: "token",
      githubUserId: "42",
      owner: "alice",
      name: "project",
      installation: {
        accountId: "42",
        accountLogin: "alice",
        accountType: "User"
      }
    });

    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("grants admin access for organization owners", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "active", role: "admin" }), { status: 200 })
    );

    const result = await hasRepositoryAdminPermission({
      accessToken: "token",
      githubUserId: "99",
      owner: "acme",
      name: "widget",
      installation: {
        accountId: "1",
        accountLogin: "acme",
        accountType: "Organization"
      }
    });

    expect(result).toBe(true);
  });

  it("checks repository permissions for collaborators", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: "active", role: "member" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ permissions: { admin: true } }), { status: 200 })
      );

    const result = await hasRepositoryAdminPermission({
      accessToken: "token",
      githubUserId: "99",
      owner: "acme",
      name: "widget",
      installation: {
        accountId: "1",
        accountLogin: "acme",
        accountType: "Organization"
      }
    });

    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/widget",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer token"
        })
      })
    );
  });

  it("denies access when GitHub reports no admin permission", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ permissions: { admin: false, push: true } }), { status: 200 })
    );

    const result = await hasRepositoryAdminPermission({
      accessToken: "token",
      githubUserId: "99",
      owner: "acme",
      name: "widget",
      installation: {
        accountId: "1",
        accountLogin: "acme",
        accountType: "Organization"
      }
    });

    expect(result).toBe(false);
  });

  it("treats failed org membership lookups as non-owner", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));

    const result = await isActiveOrgOwner("token", "acme");

    expect(result).toBe(false);
  });

  it("reuses cached org ownership checks within a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "active", role: "admin" }), { status: 200 })
    );
    const cache = createRepositoryAdminPermissionCache("token");
    const installation = {
      accountId: "1",
      accountLogin: "acme",
      accountType: "Organization"
    };

    await Promise.all([
      hasRepositoryAdminPermission({
        accessToken: "token",
        githubUserId: "99",
        owner: "acme",
        name: "widget",
        installation,
        cache
      }),
      hasRepositoryAdminPermission({
        accessToken: "token",
        githubUserId: "99",
        owner: "acme",
        name: "other",
        installation,
        cache
      })
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/user/memberships/orgs/acme",
      expect.any(Object)
    );
  });
});
