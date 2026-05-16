"use client";

import type { AdminUser, GlobalTemplateSummary } from "@superagent-cla/shared";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type TemplateViewDashboardProps = {
  apiBaseUrl: string;
  user: AdminUser;
  template: GlobalTemplateSummary;
  body: string;
};

const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1 className={cn("text-3xl font-semibold tracking-tight text-foreground", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn("mt-10 text-2xl font-semibold tracking-tight text-foreground", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-8 text-xl font-semibold tracking-tight text-foreground", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("mt-5 text-[15px] leading-7 text-muted-foreground", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-6 ml-6 list-disc space-y-2 text-[15px] text-muted-foreground", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-6 ml-6 list-decimal space-y-2 text-[15px] text-muted-foreground", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("pl-1 leading-7", className)} {...props} />,
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm font-medium text-foreground", className)}
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

export function TemplateViewDashboard({
  apiBaseUrl,
  user,
  template,
  body
}: TemplateViewDashboardProps) {
  const router = useRouter();
  const versionHash = template.latestVersion?.versionHash.slice(0, 12) ?? null;

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/templates">Templates</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{template.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {template.isMine ? (
            <Button onClick={() => router.push(`/templates/${template.templateId}/edit`)} size="sm" type="button">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          ) : null}
        </div>

        <div className="space-y-3 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
            <Badge variant="secondary">{template.source === "default" ? "Default" : "Custom"}</Badge>
            {versionHash ? (
              <span className="text-xs text-muted-foreground">Version {versionHash}</span>
            ) : null}
          </div>
          {template.description ? (
            <p className="max-w-3xl text-base text-muted-foreground">{template.description}</p>
          ) : null}
        </div>

        <article className="rounded-2xl border bg-card p-6 md:p-8">
          {body.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {body}
            </ReactMarkdown>
          ) : (
            <p className="text-sm text-muted-foreground">This template has no body yet.</p>
          )}
        </article>
      </div>
    </DashboardShell>
  );
}
