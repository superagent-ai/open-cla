import { describe, expect, it } from "vitest";
import { parseGithubOAuthScopes } from "../src/config.js";

describe("parseGithubOAuthScopes", () => {
  it("parses comma-separated scopes", () => {
    expect(parseGithubOAuthScopes("read:org, repo")).toEqual(["read:org", "repo"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseGithubOAuthScopes("  ,  , ")).toEqual([]);
  });
});
