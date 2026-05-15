import { readFile } from "node:fs/promises";
import path from "node:path";

export type ChangelogEntry = {
  id: string;
  /** Raw `##` line text after stripping the leading `## `. */
  heading: string;
  /** Markdown body below the heading. */
  body: string;
};

export type ChangelogSearchItem = ChangelogEntry & {
  date: string | null;
  title: string;
  href: string;
  searchText: string;
};

const changelogPath = path.join(process.cwd(), "content", "changelog.md");

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function parseChangelogMarkdown(markdown: string): ChangelogEntry[] {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return [];
  }

  const chunks = trimmed.split(/^## /m).filter((chunk) => chunk.length > 0);
  return chunks.map((chunk, index) => {
    const lines = chunk.split("\n");
    const heading = lines[0]?.trim() ?? "";
    const body = lines.slice(1).join("\n").trim();
    const baseId = slugify(heading);
    const id = baseId.length > 0 ? baseId : `release-${index}`;

    return { id, heading, body };
  });
}

export function splitChangelogHeading(heading: string): { date: string | null; title: string } {
  const sep = " · ";
  const idx = heading.indexOf(sep);
  if (idx === -1) {
    return { date: null, title: heading };
  }

  return {
    date: heading.slice(0, idx).trim(),
    title: heading.slice(idx + sep.length).trim()
  };
}

export async function getChangelogEntries(): Promise<ChangelogEntry[]> {
  const markdown = await readFile(changelogPath, "utf8");
  return parseChangelogMarkdown(markdown);
}

export async function getChangelogSearchIndex(): Promise<ChangelogSearchItem[]> {
  const entries = await getChangelogEntries();

  return entries.map((entry) => {
    const { date, title } = splitChangelogHeading(entry.heading);

    return {
      ...entry,
      date,
      title,
      href: `/changelog#${entry.id}`,
      searchText: [entry.heading, entry.body].join(" ")
    };
  });
}
