import { describe, expect, it } from "vitest";

import { defaultClaTemplates } from "../src/cla/templates.js";
import { markdownToPdfLines } from "../src/signing/claMarkdownPdf.js";

describe("markdownToPdfLines", () => {
  it("renders headings and lists without raw markdown syntax", () => {
    const lines = markdownToPdfLines(`# Contributor License Agreement

## 1. Definitions

You grant the project a license.

## 2. Your Representations

You represent that:

- You have the legal right to submit each Contribution.
- Each Contribution is your original work.
`);

    const joined = lines.map((line) => line.text).join("\n");

    expect(joined).toContain("Contributor License Agreement");
    expect(joined).toContain("1. Definitions");
    expect(joined).not.toContain("# ");
    expect(joined).not.toContain("## ");
    expect(joined).toContain("• You have the legal right");
    expect(lines.find((line) => line.text === "Contributor License Agreement")?.strong).toBe(true);
    expect(lines.find((line) => line.text === "1. Definitions")?.size).toBeGreaterThan(10);
  });

  it("renders the default combined CLA template", () => {
    const body = defaultClaTemplates["standard-combined-v1"]!.body;
    const lines = markdownToPdfLines(body);
    const joined = lines.map((line) => line.text).join("\n");

    expect(lines.length).toBeGreaterThan(20);
    expect(joined).toContain("Standard Contributor License Agreement");
    expect(joined).toContain("7. Agreement");
    expect(joined).not.toMatch(/##\s+\d+\./);
  });
});
