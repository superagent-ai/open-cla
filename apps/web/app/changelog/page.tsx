import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AdminUser } from "@superagent-cla/shared";

import { DashboardShell } from "@/components/dashboard-shell";
import { adminApiFetch, browserApiBaseUrl, webBaseUrl } from "@/lib/api";
import type { ChangelogEntry } from "@/lib/changelog";
import { getChangelogEntries, getChangelogSearchIndex, splitChangelogHeading } from "@/lib/changelog";
import { cn } from "@/lib/utils";

const changelogTitle = "Changelog | OpenCLA";
const changelogDescription = "Latest OpenCLA updates, releases, and improvements.";

export const metadata: Metadata = {
  metadataBase: new URL(webBaseUrl),
  title: changelogTitle,
  description: changelogDescription,
  alternates: {
    canonical: "/changelog"
  },
  openGraph: {
    title: changelogTitle,
    description: changelogDescription,
    url: "/changelog",
    siteName: "OpenCLA",
    type: "website",
    images: [
      {
        url: "/changelog/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OpenCLA changelog"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: changelogTitle,
    description: changelogDescription,
    images: [
      {
        url: "/changelog/twitter-image",
        alt: "OpenCLA changelog"
      }
    ]
  }
};

function getTextContent(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(getTextContent).join("");
  }

  return "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

const markdownComponents: Components = {
  h2: ({ className, children, id, ...props }) => {
    const headingId = id ?? slugify(getTextContent(children));

    return (
      <h3
        id={headingId}
        className={cn(
          "mt-10 scroll-m-24 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground first:mt-0",
          className
        )}
        {...props}
      >
        {children}
      </h3>
    );
  },
  h3: ({ className, children, id, ...props }) => {
    const headingId = id ?? slugify(getTextContent(children));

    return (
      <h4
        id={headingId}
        className={cn("mt-8 scroll-m-24 text-lg font-semibold tracking-tight text-foreground", className)}
        {...props}
      >
        {children}
      </h4>
    );
  },
  p: ({ className, ...props }) => (
    <p className={cn("mt-5 text-[17px] leading-8 text-foreground", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "font-semibold text-foreground underline underline-offset-4 transition-colors hover:bg-muted/50 hover:text-foreground",
        className
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-6 ml-6 list-disc space-y-3 text-[17px] leading-8 text-foreground", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-6 ml-6 list-decimal space-y-5 text-[17px] leading-8 text-foreground", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("pl-1 leading-7", className)} {...props} />,
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm font-medium text-foreground",
        className
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre className={cn("my-6 overflow-x-auto rounded-xl border border-border bg-muted/40 p-4", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn("mt-6 border-l-2 border-border pl-6 italic text-muted-foreground", className)} {...props} />
  ),
  img: ({ className, alt, ...props }) => (
    <img
      alt={alt ?? ""}
      className={cn("mb-8 mt-0 w-full rounded-lg border border-border bg-muted object-cover", className)}
      {...props}
    />
  )
};

async function getCurrentUser(): Promise<AdminUser | null> {
  try {
    return await adminApiFetch<AdminUser>("/api/admin/me");
  } catch {
    return null;
  }
}

function ChangelogEntrySection({ entry }: { entry: ChangelogEntry }) {
  const { date, title } = splitChangelogHeading(entry.heading);

  return (
    <section
      id={entry.id}
      className="grid scroll-mt-28 grid-cols-1 gap-6 border-t border-border/70 py-16 md:grid-cols-[160px_minmax(0,668px)] md:gap-16 md:py-20"
    >
      <div className="md:pt-1">
        {date ? <p className="text-xl font-medium tabular-nums tracking-[-0.02em] text-muted-foreground/70">{date}</p> : null}
      </div>

      <div className="min-w-0">
        <h2 className="text-[42px] font-semibold leading-[1.08] tracking-[-0.055em] text-foreground md:text-5xl">
          {title}
        </h2>

        <div className="changelog-entry-body mt-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {entry.body}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
}

export default async function ChangelogPage() {
  const [entries, searchItems, user] = await Promise.all([
    getChangelogEntries(),
    getChangelogSearchIndex(),
    getCurrentUser()
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
      <DashboardShell
        apiBaseUrl={browserApiBaseUrl}
        user={user}
        changelogSearchItems={searchItems}
        contentClassName="w-full max-w-none px-0 pb-0 pt-0"
      >
        <div className="mx-auto w-full max-w-[956px] px-5 pb-20 pt-10 md:px-8 md:pt-16">
          <header className="pb-14 md:pb-16">
            <h1 className="text-[42px] font-semibold leading-none tracking-[-0.055em] text-foreground md:text-5xl">
              Changelog
            </h1>
          </header>

          {entries.map((entry) => (
            <ChangelogEntrySection key={entry.id} entry={entry} />
          ))}
        </div>
      </DashboardShell>
    </Suspense>
  );
}
