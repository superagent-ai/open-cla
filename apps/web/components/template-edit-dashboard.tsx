"use client";

import type { AdminUser, GlobalTemplateSummary } from "@superagent-cla/shared";
import { Copy, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>(body);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      setError("Title is required.");
      return;
    }

    const trimmedBody = markdown.trim();
    if (!trimmedBody) {
      setError("Template body cannot be empty.");
      return;
    }

    setPending(true);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: title,
          description: String(form.get("description") ?? ""),
          title,
          body: trimmedBody
        })
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      setPending(false);
      setSaving(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save template");
      setPending(false);
      setSaving(false);
    }
  }

  async function duplicateTemplate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/templates/${templateId}/duplicate`, {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      const payload = (await response.json()) as { templateId: string };
      router.push(`/templates/${payload.templateId}/edit`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to duplicate template");
      setPending(false);
    }
  }

  async function deleteTemplate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      router.push("/templates");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete template");
      setPending(false);
      setDeleteOpen(false);
    }
  }

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      <form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
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
                  <DropdownMenuItem onSelect={() => void duplicateTemplate()}>
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
                      void deleteTemplate();
                    }}
                    variant="destructive"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              className="-ml-px !rounded-l-none"
              disabled={pending}
              size="sm"
              type="submit"
              variant="outline"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </ButtonGroup>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
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

async function getResponseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; issues?: Array<{ path?: Array<string | number>; message?: string }> }
    | null;
  const detail = payload?.issues?.length
    ? payload.issues
        .map((issue) => `${issue.path?.join(".") ?? "field"}: ${issue.message ?? "invalid"}`)
        .join("; ")
    : null;

  return detail
    ? `${payload?.error ?? "Invalid request"} - ${detail}`
    : payload?.error ?? `Request failed with ${response.status}`;
}
