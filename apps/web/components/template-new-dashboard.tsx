"use client";

import type { AdminUser } from "@superagent-cla/shared";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Value } from "platejs";
import { useActionState, useState } from "react";
import { Toaster } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { TemplatePlateEditor } from "@/components/editor/template-plate-editor";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTemplateAction } from "@/lib/actions/templates";
import { emptyActionResult } from "@/lib/actions/types";

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
  const [markdown, setMarkdown] = useState("");
  const [state, formAction] = useActionState(createTemplateAction, emptyActionResult());

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      <form action={formAction} className="flex flex-col gap-6">
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
              onClick={() => router.push("/templates")}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…" size="sm">
              Save template
            </SubmitButton>
          </div>
        </div>

        {state.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.error}
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

        <input name="body" type="hidden" value={markdown} />

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
