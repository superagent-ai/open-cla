"use client";

import type { AdminUser, ClaContentFormat, GlobalTemplateSummary } from "@superagent-cla/shared";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { DashboardShell } from "@/components/dashboard-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { deleteTemplateAction } from "@/lib/actions/templates";
import { cn } from "@/lib/utils";

type TemplateViewDashboardProps = {
  apiBaseUrl: string;
  user: AdminUser;
  template: GlobalTemplateSummary;
  contentFormat: ClaContentFormat;
  body: string;
  pdfUrl: string | null;
  pdfFileName: string | null;
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
  contentFormat,
  body,
  pdfUrl,
  pdfFileName
}: TemplateViewDashboardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const versionHash = template.latestVersion?.versionHash.slice(0, 12) ?? null;
  const isPdf = contentFormat === "pdf" && pdfUrl;

  function runDelete(): void {
    setActionError(null);
    startTransition(async () => {
      try {
        await deleteTemplateAction(template.templateId);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to delete template");
        setDeleteOpen(false);
      }
    });
  }

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isPending} size="icon" type="button" variant="outline">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {actionError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}

        <div className="space-y-3 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
            <Badge variant="secondary">{template.source === "default" ? "Default" : "Custom"}</Badge>
            {isPdf ? <Badge variant="outline">PDF</Badge> : null}
            {versionHash ? (
              <span className="text-xs text-muted-foreground">Version {versionHash}</span>
            ) : null}
          </div>
          {template.description ? (
            <p className="max-w-3xl text-base text-muted-foreground">{template.description}</p>
          ) : null}
        </div>

        {isPdf && pdfUrl ? (
          <iframe
            className="h-[min(80vh,900px)] w-full"
            src={pdfUrl}
            title="CLA template PDF"
          />
        ) : (
          <article className="rounded-2xl border bg-card p-6 md:p-8">
            {body.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {body}
              </ReactMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground">This template has no content.</p>
            )}
          </article>
        )}
      </div>

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes &quot;{template.name}&quot; permanently. Repositories using it will need another template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={runDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

