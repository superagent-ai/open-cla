import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AdminUser } from "@superagent-cla/shared";

import { DashboardShell } from "@/components/dashboard-shell";
import { adminApiFetch, browserApiBaseUrl } from "@/lib/api";
import { getDocForRequest, getDocsNavSections, getDocsSearchIndex } from "@/lib/docs";
import { cn } from "@/lib/utils";

type DocsPageProps = {
  searchParams: Promise<{ doc?: string }>;
};

export async function generateMetadata({ searchParams }: DocsPageProps): Promise<Metadata> {
  const { doc: docSlug } = await searchParams;
  const doc = await getDocForRequest(docSlug);

  if (!doc) {
    return {
      title: "Docs | OpenCLA",
      description: "Documentation for setting up and using OpenCLA."
    };
  }

  return {
    title: `${doc.title} | OpenCLA`,
    description: doc.description
  };
}

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
  h1: ({ className, ...props }) => (
    <h1 className={cn("scroll-m-20 text-4xl font-semibold tracking-tight text-foreground", className)} {...props} />
  ),
  h2: ({ className, children, id, ...props }) => {
    const headingId = id ?? slugify(getTextContent(children));

    return (
      <h2
        id={headingId}
        className={cn("mt-12 scroll-m-24 text-3xl font-medium tracking-tight text-foreground", className)}
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3: ({ className, children, id, ...props }) => {
    const headingId = id ?? slugify(getTextContent(children));

    return (
      <h3
        id={headingId}
        className={cn("mt-9 scroll-m-24 text-xl font-semibold tracking-tight text-foreground", className)}
        {...props}
      >
        {children}
      </h3>
    );
  },
  p: ({ className, ...props }) => (
    <p className={cn("mt-5 text-[15px] leading-7 text-muted-foreground", className)} {...props} />
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
    <ul className={cn("my-6 ml-6 list-disc space-y-2 text-[15px] text-muted-foreground", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-6 ml-6 list-decimal space-y-2 text-[15px] text-muted-foreground", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("pl-1 leading-7", className)} {...props} />,
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
  )
};

async function getCurrentUser(): Promise<AdminUser | null> {
  try {
    return await adminApiFetch<AdminUser>("/api/admin/me");
  } catch {
    return null;
  }
}

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const { doc: docSlug } = await searchParams;

  const [doc, navSections, searchItems, user] = await Promise.all([
    getDocForRequest(docSlug),
    Promise.resolve(getDocsNavSections()),
    getDocsSearchIndex(),
    getCurrentUser()
  ]);

  if (!doc) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
      <DashboardShell
        apiBaseUrl={browserApiBaseUrl}
        user={user}
        docsSearchItems={searchItems}
        contentClassName="w-full max-w-none px-0 pb-0 pt-0"
      >
        <div className="mx-auto grid w-full max-w-[1364px] grid-cols-1 px-5 py-10 md:px-8 lg:grid-cols-[260px_minmax(0,768px)_240px] lg:justify-center lg:gap-12">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-4" aria-label="Docs navigation">
            {navSections.map((section) => (
              <div key={section.title} className="mb-4 last:mb-0">
                <p className="mb-1 px-2 text-sm font-semibold text-foreground">{section.title}</p>
                <div className="flex flex-col">
                  {section.items.map((item) => (
                    <Link
                      key={item.slug}
                      href={item.href}
                      aria-current={item.slug === doc.slug ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-2 py-2 text-sm leading-snug text-foreground transition-colors",
                        item.slug === doc.slug
                          ? "bg-accent font-medium text-accent-foreground"
                          : "hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <article className="mx-auto min-w-0 max-w-3xl lg:mx-0">
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground">{doc.section}</p>
            <h1 className="mt-3 text-4xl font-medium tracking-[-0.03em] text-foreground md:text-5xl">
              {doc.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[17px] leading-8 text-muted-foreground">{doc.description}</p>
          </div>

          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {doc.content}
          </ReactMarkdown>
        </article>

        <aside className="hidden lg:block">
          <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pl-2" aria-label="On this page">
            <p className="mb-3 px-2 text-sm font-medium leading-5 text-foreground">On this page</p>
            <div className="flex flex-col gap-1">
              {doc.toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={cn(
                    "block rounded-md px-2 py-1 text-sm leading-5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                    item.level === 3 && "pl-5"
                  )}
                >
                  {item.title}
                </a>
              ))}
            </div>
          </nav>
        </aside>
        </div>
      </DashboardShell>
    </Suspense>
  );
}
