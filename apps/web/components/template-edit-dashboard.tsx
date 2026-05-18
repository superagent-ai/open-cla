"use client";

import type { AdminUser, GlobalTemplateSummary } from "@superagent-cla/shared";
import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Toaster } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { TemplatePlateEditor } from "@/components/editor/template-plate-editor";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  updateTemplateAction
} from "@/lib/actions/templates";
import { emptyActionResult } from "@/lib/actions/types";

type TemplateEditDashboardProps = {
  apiBaseUrl: string;
  user: AdminUser;
  templateId: string;
  template: GlobalTemplateSummary;
  body: string;
};

export function TemplateEditDashboard({
  apiBaseUrl,
  user,
  templateId,
  template,
  body
}: TemplateEditDashboardProps) {
  const [markdown, setMarkdown] = useState(body);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const updateAction = updateTemplateAction.bind(null, templateId);
  const [state, formAction, savePending] = useActionState(updateAction, emptyActionResult());
  const wasSavingRef = useRef(false);

  const pending = isPending || savePending;
  const error = actionError ?? state.error;

  useEffect(() => {
    if (wasSavingRef.current && !savePending && !state.error) {
      setSaved(true);
    }
    wasSavingRef.current = savePending;
  }, [savePending, state.error]);

  function runAction(work: () => Promise<void>): void {
    setActionError(null);
    startTransition(async () => {
      try {
        await work();
      } catch (caught) {
        setActionError(caught instanceof Error ? caught.message : "Request failed");
      }
    });
  }

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      <form action={formAction} className="flex flex-col gap-6">
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
          <ButtonGroup aria-label="Template actions">
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="More template actions"
                    className="!rounded-r-none"
                    disabled={pending}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onSelect={() =>
                      runAction(() => duplicateTemplateAction(templateId))
                    }
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setDeleteOpen(true);
                    }}
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete template?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes “{template.name}” and any versions attached to it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={pending}
                    onClick={(event) => {
                      event.preventDefault();
                      runAction(() => deleteTemplateAction(templateId));
                    }}
                    variant="destructive"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <SubmitButton
              className="-ml-px !rounded-l-none"
              disabled={pending}
              pendingLabel="Saving…"
              size="sm"
              variant="outline"
            >
              Save
            </SubmitButton>
          </ButtonGroup>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {saved && !error && !savePending ? (
          <p className="text-sm text-muted-foreground">Template saved.</p>
        ) : null}

        <div className="space-y-2 px-1">
          <input
            aria-label="Signing page title"
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
            defaultValue={template.name}
            name="title"
            placeholder="Untitled CLA"
            required
          />
          <input
            aria-label="Description"
            className="w-full bg-transparent text-base text-muted-foreground outline-none placeholder:text-muted-foreground/50"
            defaultValue={template.description ?? ""}
            name="description"
            placeholder="Add a short description"
          />
        </div>

        <input name="body" type="hidden" value={markdown} />

        <div className="overflow-hidden rounded-2xl border bg-card">
          <TemplatePlateEditor
            initialMarkdown={body}
            onChange={({ markdown: nextMarkdown }) => setMarkdown(nextMarkdown)}
          />
        </div>
      </form>

      <Toaster />
    </DashboardShell>
  );
}
