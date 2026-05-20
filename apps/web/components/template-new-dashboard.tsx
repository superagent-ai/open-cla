"use client";

import type { AdminUser } from "@superagent-cla/shared";
import { ArrowLeft, FileUp, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster, toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fileToBase64 } from "@/lib/file-to-base64";

type TemplateNewDashboardProps = {
  apiBaseUrl: string;
  user: AdminUser;
};

export function TemplateNewDashboard({ apiBaseUrl, user }: TemplateNewDashboardProps) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"pdf" | "dropbox">("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function onFileSelected(file: File): void {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("PDF must be 20 MB or smaller.");
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const dropboxTemplateId = String(formData.get("dropboxTemplateId") ?? "").trim();
    const dropboxApiKey = String(formData.get("dropboxApiKey") ?? "").trim();
    const signerRole = String(formData.get("signerRole") ?? "").trim();

    if (!title) {
      setError("Title is required.");
      return;
    }
    if (sourceType === "pdf" && !selectedFile) {
      setError("Upload a PDF before saving the template.");
      return;
    }
    if (sourceType === "dropbox" && (!dropboxTemplateId || !dropboxApiKey)) {
      setError("Dropbox template ID and API key are required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload =
        sourceType === "dropbox"
          ? {
              name: title,
              description: description || undefined,
              title,
              dropboxTemplateId,
              dropboxApiKey,
              signerRole: signerRole || undefined
            }
          : {
              name: title,
              description: description || undefined,
              title,
              pdfFileName: selectedFile!.name,
              pdfBase64: await fileToBase64(selectedFile!)
            };
      const response = await fetch(
        `${apiBaseUrl}/api/admin/templates/${sourceType === "dropbox" ? "dropbox" : "global"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const result = (await response.json().catch(() => null)) as { error?: string; templateId?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? `Save failed (${response.status})`);
      }

      router.push(result?.templateId ? `/templates/${result.templateId}` : "/templates");
      router.refresh();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save template";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
            <Button onClick={() => router.push("/templates")} size="sm" type="button" variant="outline">
              Cancel
            </Button>
            <SubmitButton
              disabled={(sourceType === "pdf" && !selectedFile) || isSaving}
              pendingLabel="Saving…"
              size="sm"
            >
              Save template
            </SubmitButton>
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

        <Tabs value={sourceType} onValueChange={(value) => setSourceType(value as "pdf" | "dropbox")}>
          <TabsList>
            <TabsTrigger value="pdf">Upload PDF</TabsTrigger>
            <TabsTrigger value="dropbox">Import from Dropbox</TabsTrigger>
          </TabsList>
          <TabsContent value="pdf">
            <div className={selectedFile ? undefined : "overflow-hidden rounded-2xl border bg-card"}>
              <div
                className={
                  selectedFile
                    ? "flex flex-col gap-4"
                    : "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center"
                }
              >
                {selectedFile && previewUrl ? (
                  <>
                    <iframe className="h-[min(70vh,720px)] w-full" src={previewUrl} title="CLA PDF preview" />
                    <Button
                      onClick={() => document.getElementById("template-pdf-input")?.click()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Replace PDF
                    </Button>
                  </>
                ) : (
                  <>
                    <FileUp className="h-10 w-10 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Upload your CLA as a PDF</p>
                      <p className="max-w-md text-sm text-muted-foreground">
                        The file is stored in your database. Custom templates are PDF-only.
                      </p>
                    </div>
                    <Button onClick={() => document.getElementById("template-pdf-input")?.click()} size="sm" type="button">
                      Choose PDF
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="dropbox">
            <div className="rounded-2xl border bg-card p-6">
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-full bg-teal-500/10 p-2 text-teal-700 dark:text-teal-300">
                  <PenLine className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Use a Dropbox Sign template</p>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    OpenCLA stores the template ID and signer role. The document fields stay configured in Dropbox Sign.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="dropboxTemplateId">
                    Dropbox template ID
                  </label>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    id="dropboxTemplateId"
                    name="dropboxTemplateId"
                    placeholder="f57db65d3f..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="signerRole">
                    Signer role
                  </label>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    id="signerRole"
                    name="signerRole"
                    placeholder="Signer"
                  />
                  <p className="text-xs text-muted-foreground">Required only if the template has multiple roles.</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="dropboxApiKey">
                    Dropbox Sign API key
                  </label>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    id="dropboxApiKey"
                    name="dropboxApiKey"
                    placeholder="Used once to validate this template"
                    type="password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Saved to your account and reused when you enable Dropbox Sign on a repository.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <input
          accept="application/pdf,.pdf"
          className="sr-only"
          id="template-pdf-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              onFileSelected(file);
            }
          }}
          type="file"
        />
      </form>

      <Toaster />
    </DashboardShell>
  );
}
