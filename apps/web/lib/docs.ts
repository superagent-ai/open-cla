import { readFile } from "node:fs/promises";
import path from "node:path";

type DocConfig = {
  slug: string;
  title: string;
  description: string;
  label: string;
  section: string;
  file: string;
  toc: DocTocItem[];
};

export type DocNavItem = Omit<DocConfig, "file"> & {
  href: string;
};

export type DocNavSection = {
  title: string;
  items: DocNavItem[];
};

export type DocTocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

export type Doc = DocNavItem & {
  content: string;
};

export type DocSearchItem = Doc & {
  searchText: string;
};

const docsDirectory = path.join(process.cwd(), "content", "docs");

const docs = [
  {
    slug: "getting-started",
    title: "OpenCLA overview",
    description: "What OpenCLA does, how checks work, and how to roll it out.",
    label: "Overview",
    section: "Get started",
    file: "getting-started.md",
    toc: [
      { id: "what-opencla-does", title: "What OpenCLA does", level: 2 },
      { id: "the-cla-check-on-pull-requests", title: "The CLA check on pull requests", level: 2 },
      { id: "personal-and-organization-clas", title: "Personal and organization CLAs", level: 2 },
      { id: "who-does-what", title: "Who does what", level: 2 },
      { id: "end-to-end-flow", title: "End-to-end flow", level: 2 },
      { id: "next-steps", title: "Next steps", level: 2 }
    ]
  },
  {
    slug: "install-github-app",
    title: "Install the GitHub App",
    description: "Configure and install OpenCLA on personal or organization repositories.",
    label: "Install the GitHub App",
    section: "Get started",
    file: "install-github-app.md",
    toc: [
      { id: "where-the-app-runs", title: "Where the app runs", level: 2 },
      { id: "github-app-configuration", title: "GitHub App configuration", level: 2 },
      { id: "repository-permissions", title: "Repository permissions", level: 2 },
      { id: "organization-permission", title: "Organization permission", level: 2 },
      { id: "installing-on-personal-vs-organization-accounts", title: "Installing on personal vs organization accounts", level: 2 },
      { id: "after-installation", title: "After installation", level: 2 },
      { id: "contributor-signing-url", title: "Contributor signing URL", level: 2 }
    ]
  },
  {
    slug: "templates",
    title: "CLA templates",
    description: "Create global templates and attach them to repositories from the admin UI.",
    label: "Templates",
    section: "Admin",
    file: "templates.md",
    toc: [
      { id: "how-templates-fit-in", title: "How templates fit in", level: 2 },
      { id: "global-templates", title: "Global templates", level: 2 },
      { id: "creating-a-template", title: "Creating a template", level: 2 },
      { id: "selecting-a-template-for-a-repository", title: "Selecting a template for a repository", level: 2 },
      { id: "versions-and-the-cla-hash", title: "Versions and the CLA hash", level: 2 },
      { id: "admin-access", title: "Admin access", level: 2 }
    ]
  },
  {
    slug: "signing-personal-vs-corporate",
    title: "Personal and organization CLAs",
    description: "How contributors get coverage: personal signatures vs corporate agreements.",
    label: "Personal and org CLAs",
    section: "Contributors",
    file: "signing-personal-vs-corporate.md",
    toc: [
      { id: "before-you-sign", title: "Before you sign", level: 2 },
      { id: "personal-cla", title: "Personal CLA", level: 2 },
      { id: "corporate-organization-cla", title: "Corporate organization CLA", level: 2 },
      { id: "how-coverage-is-decided", title: "How coverage is decided", level: 2 },
      { id: "organization-membership", title: "Organization membership", level: 2 },
      { id: "if-the-check-still-fails", title: "If the check still fails", level: 2 },
      { id: "retest-the-check-on-an-open-pr", title: "Retest the check on an open PR", level: 2 }
    ]
  },
  {
    slug: "local-development",
    title: "Self-hosting and local development",
    description: "Run the API and admin UI locally or deploy your own OpenCLA instance.",
    label: "Self-hosting (dev)",
    section: "Reference",
    file: "local-development.md",
    toc: [
      { id: "repository-layout", title: "Repository layout", level: 2 },
      { id: "environment-variables", title: "Environment variables", level: 2 },
      { id: "github-app-and-webhook", title: "GitHub App and webhook", level: 2 },
      { id: "github-oauth-for-sign-in", title: "GitHub OAuth for sign-in", level: 2 },
      { id: "database", title: "Database", level: 2 },
      { id: "running-the-stack", title: "Running the stack", level: 2 }
    ]
  }
] as const satisfies readonly DocConfig[];

function getDocHref(slug: string): string {
  return slug === docs[0].slug ? "/docs" : `/docs?doc=${encodeURIComponent(slug)}`;
}

function toNavItem({ file: _file, ...doc }: DocConfig): DocNavItem {
  return {
    ...doc,
    href: getDocHref(doc.slug)
  };
}

export function getDocsNav(): DocNavItem[] {
  return docs.map(toNavItem);
}

export function getDocsNavSections(): DocNavSection[] {
  const sections = new Map<string, DocNavItem[]>();

  for (const doc of docs) {
    const item = toNavItem(doc);
    sections.set(doc.section, [...(sections.get(doc.section) ?? []), item]);
  }

  return Array.from(sections, ([title, items]) => ({ title, items }));
}

export async function getDocBySlug(slug: string): Promise<Doc | null> {
  const doc = docs.find((item) => item.slug === slug);

  if (!doc) {
    return null;
  }

  const content = await readFile(path.join(docsDirectory, doc.file), "utf8");

  return {
    ...toNavItem(doc),
    content
  };
}

export async function getDefaultDoc(): Promise<Doc | null> {
  return getDocBySlug(docs[0].slug);
}

/**
 * Resolves the doc to show for `/docs` and `/docs?doc=…`. Unknown slugs fall back to the default doc.
 */
export async function getDocForRequest(docQuery: string | undefined): Promise<Doc | null> {
  const trimmed = docQuery?.trim();

  if (!trimmed) {
    return getDefaultDoc();
  }

  const requested = await getDocBySlug(trimmed);
  if (requested) {
    return requested;
  }

  return getDefaultDoc();
}

export async function getDocsSearchIndex(): Promise<DocSearchItem[]> {
  const items = await Promise.all(docs.map((doc) => getDocBySlug(doc.slug)));

  return items.flatMap((doc) => {
    if (!doc) {
      return [];
    }

    return {
      ...doc,
      searchText: [doc.title, doc.description, doc.content].join(" ")
    };
  });
}
