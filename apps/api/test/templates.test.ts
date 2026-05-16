import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLA_TEMPLATE_FALLBACK_NAME,
  getDefaultTemplate,
  listDefaultTemplates
} from "../src/cla/templates.js";

describe("default CLA templates", () => {
  it("ships a useful bundled template catalog", () => {
    const templates = listDefaultTemplates();
    const names = templates.map((template) => template.name);

    expect(names).toEqual([
      "standard-combined-v1",
      "inbound-outbound-v1",
      "copyright-only-v1",
      "patent-grant-v1",
      "organization-covered-v1",
      "docs-content-v1",
      "experimental-research-v1",
      "individual-v1"
    ]);

    for (const template of templates) {
      expect(template.title).toContain("Agreement");
      expect(template.description.length).toBeGreaterThan(20);
      expect(template.body).toContain(`# ${template.title}`);
      expect(template.body).toContain("By signing");
      expect(template.body).not.toContain("placeholder");
    }
  });

  it("falls back to the standard combined template", () => {
    expect(getDefaultTemplate("not-a-template").name).toBe(DEFAULT_CLA_TEMPLATE_FALLBACK_NAME);
  });
});
