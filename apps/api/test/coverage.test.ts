import { describe, expect, it } from "vitest";
import { evaluateCoverage, type Contributor } from "../src/cla/coverage.js";

const alice: Contributor = { githubUserId: "1", login: "alice" };
const bob: Contributor = { githubUserId: "2", login: "bob" };

describe("evaluateCoverage", () => {
  it("covers contributors with personal signatures", async () => {
    const result = await evaluateCoverage({
      contributors: [alice],
      personallySignedUserIds: new Set(["1"]),
      corporateAgreements: [],
      membershipVerifier: async () => false
    });

    expect(result.covered).toBe(true);
    expect(result.coveredContributors).toEqual([
      expect.objectContaining({ login: "alice", reason: "personal" })
    ]);
  });

  it("covers contributors through corporate agreements", async () => {
    const result = await evaluateCoverage({
      contributors: [bob],
      personallySignedUserIds: new Set(),
      corporateAgreements: [{ orgId: "10", orgLogin: "acme", effectiveUntil: null }],
      membershipVerifier: async ({ orgLogin, contributor }) =>
        orgLogin === "acme" && contributor.login === "bob"
    });

    expect(result.covered).toBe(true);
    expect(result.coveredContributors).toEqual([
      expect.objectContaining({
        login: "bob",
        reason: "corporate",
        corporateOrgLogin: "acme"
      })
    ]);
  });

  it("reports contributors missing CLA coverage", async () => {
    const result = await evaluateCoverage({
      contributors: [alice, bob],
      personallySignedUserIds: new Set(["1"]),
      corporateAgreements: [],
      membershipVerifier: async () => false
    });

    expect(result.covered).toBe(false);
    expect(result.missingContributors).toEqual([
      expect.objectContaining({ login: "bob" })
    ]);
  });

  it("does not require bot contributors to sign a CLA", async () => {
    const result = await evaluateCoverage({
      contributors: [
        alice,
        { githubUserId: "3", login: "dependabot[bot]", isBot: true }
      ],
      personallySignedUserIds: new Set(["1"]),
      corporateAgreements: [],
      membershipVerifier: async () => false
    });

    expect(result.covered).toBe(true);
    expect(result.coveredContributors).toEqual([
      expect.objectContaining({ login: "alice", reason: "personal" }),
      expect.objectContaining({ login: "dependabot[bot]", reason: "bot" })
    ]);
    expect(result.missingContributors).toEqual([]);
  });
});
