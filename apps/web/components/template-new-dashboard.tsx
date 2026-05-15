"use client";

import type { AdminUser } from "@superagent-cla/shared";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Value } from "platejs";
import { useState, type FormEvent } from "react";
import { Toaster } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { TemplatePlateEditor } from "@/components/editor/template-plate-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TemplateNewDashboardProps = {
  apiBaseUrl: string;
  user: AdminUser;
};

const initialEditorValue: Value = [
  {
    type: "p",
    children: [{ text: "" }]
  }
];

export function TemplateNewDashboard({ apiBaseUrl, user }: TemplateNewDashboardProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const body = markdown.trim();
    if (!body) {
      setError("Template body cannot be empty.");
      return;
    }

    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      setError("Title is required.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/templates/global`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: title,
          description: String(form.get("description") ?? ""),
          title,
          body
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; issues?: Array<{ path?: Array<string | number>; message?: string }> }
          | null;
        const detail = payload?.issues?.length
          ? payload.issues
              .map(
                (issue) =>
                  `${issue.path?.join(".") ?? "field"}: ${issue.message ?? "invalid"}`
              )
              .join("; ")
          : null;
        throw new Error(
          detail
            ? `${payload?.error ?? "Invalid request"} – ${detail}`
            : payload?.error ?? `Request failed with ${response.status}`
        );
      }

      router.push("/templates");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create template");
      setPending(false);
    }
  }

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      <form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/templates")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All templates
          </button>
          <div className="flex items-center gap-3">
            <Button
              disabled={pending}
              onClick={() => router.push("/templates")}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending} size="sm" type="submit">
              Save template
            </Button>
          </div>
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
            name="title"
            placeholder="Untitled CLA"
            required
          />
          <input
            aria-label="Description"
            className="w-full bg-transparent text-base text-muted-foreground outline-none placeholder:text-muted-foreground/50"
            name="description"
            placeholder="Add a short description"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          <TemplatePlateEditor
            initialValue={initialEditorValue}
            onChange={({ markdown: nextMarkdown }) => setMarkdown(nextMarkdown)}
          />
        </div>
      </form>

      <Toaster />
    </DashboardShell>
  );
}
