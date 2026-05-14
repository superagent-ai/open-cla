"use client";

import type {
  AdminInstallation,
  AdminUser,
  SignaturesResponse,
  TemplatesResponse
} from "@superagent-cla/shared";
import { CheckCircle2, FileText, Upload, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type AdminDashboardProps = {
  apiBaseUrl: string;
  user: AdminUser;
  installations: AdminInstallation[];
  selectedRepositoryId: string | null;
  templatesResponse: TemplatesResponse | null;
  signaturesResponse: SignaturesResponse | null;
};

export function AdminDashboard({
  apiBaseUrl,
  user,
  installations,
  selectedRepositoryId,
  templatesResponse,
  signaturesResponse
}: AdminDashboardProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repositories = useMemo(
    () => installations.flatMap((installation) => installation.repositories),
    [installations]
  );

  async function selectTemplate(templateVersionId: string | null) {
    if (!selectedRepositoryId) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await fetch(
        `${apiBaseUrl}/api/admin/repositories/${selectedRepositoryId}/template-selection`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ repositoryId: selectedRepositoryId, templateVersionId })
        }
      ).then(assertOk);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to select template");
    } finally {
      setPending(false);
    }
  }

  async function uploadTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRepositoryId) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await fetch(`${apiBaseUrl}/api/admin/templates`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repositoryId: selectedRepositoryId,
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
          title: String(form.get("title") ?? ""),
          body: String(form.get("body") ?? "")
        })
      }).then(assertOk);
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload template");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError(null);
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include"
      }).then(assertOk);
      window.location.href = "/";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to log out");
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">OpenCLA</p>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Console</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-full border bg-white px-4 py-2 text-sm">
              <UserCircle className="h-4 w-4" />
              <span>@{user.login}</span>
            </div>
            <Button disabled={pending} onClick={() => void logout()} variant="outline">
              Log out
            </Button>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Repositories</CardTitle>
              <CardDescription>Select the account/repository context to manage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {repositories.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No installed repositories where your GitHub user has admin access were found.
                </p>
              ) : (
                repositories.map((repository) => (
                  <Button
                    key={repository.repositoryId}
                    className="w-full justify-start"
                    variant={repository.repositoryId === selectedRepositoryId ? "default" : "outline"}
                    onClick={() => router.push(`/?repositoryId=${repository.repositoryId}`)}
                  >
                    {repository.fullName}
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          {!selectedRepositoryId || !templatesResponse ? (
            <Card>
              <CardHeader>
                <CardTitle>Choose A Repository</CardTitle>
                <CardDescription>
                  Template selection and signature visibility are always scoped to a repository.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Templates For {templatesResponse.repository.fullName}
                  </CardTitle>
                  <CardDescription>
                    Current mode:{" "}
                    <Badge variant="secondary">{templatesResponse.settings.mode}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => void selectTemplate(null)}
                  >
                    Use repository CLA.md fallback
                  </Button>
                  <div className="grid gap-3 md:grid-cols-2">
                    {templatesResponse.templates.map((template) => (
                      <div key={template.templateId} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-medium">{template.name}</h3>
                            <p className="text-sm text-slate-500">
                              {template.description ?? "No description"}
                            </p>
                          </div>
                          <Badge variant={template.source === "default" ? "secondary" : "outline"}>
                            {template.source}
                          </Badge>
                        </div>
                        {template.latestVersion ? (
                          <div className="mt-4 space-y-3">
                            <p className="text-xs text-slate-500">
                              Hash {template.latestVersion.versionHash.slice(0, 12)}
                            </p>
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() =>
                                void selectTemplate(template.latestVersion!.templateVersionId)
                              }
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Select Version
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-slate-500">No versions yet.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Template
                  </CardTitle>
                  <CardDescription>
                    Uploaded text becomes an immutable version and is selected for this repository.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={(event) => void uploadTemplate(event)}>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="name">
                        Template name
                      </label>
                      <Input id="name" name="name" required />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="description">
                        Description
                      </label>
                      <Input id="description" name="description" />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="title">
                        Signing page title
                      </label>
                      <Input id="title" name="title" required />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="body">
                        Template body
                      </label>
                      <Textarea id="body" name="body" required />
                    </div>
                    <Button className="w-fit" disabled={pending} type="submit">
                      Upload and select
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {signaturesResponse ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Signatures And Checks</CardTitle>
                    <CardDescription>See who has signed and recent CLA check outcomes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Signer</TableHead>
                          <TableHead>Kind</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>Signed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signaturesResponse.signatures.map((signature) => (
                          <TableRow
                            key={`${signature.kind}-${signature.signerLogin}-${signature.claVersionHash}`}
                          >
                            <TableCell>@{signature.signerLogin}</TableCell>
                            <TableCell>{signature.kind}</TableCell>
                            <TableCell>{signature.organizationLogin ?? "-"}</TableCell>
                            <TableCell>{new Date(signature.signedAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PR</TableHead>
                          <TableHead>Conclusion</TableHead>
                          <TableHead>Summary</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signaturesResponse.pullRequestChecks.map((check) => (
                          <TableRow key={`${check.pullNumber}-${check.headSha}`}>
                            <TableCell>#{check.pullNumber}</TableCell>
                            <TableCell>{check.conclusion ?? "pending"}</TableCell>
                            <TableCell>{check.lastSummary ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  let message = `Request failed with ${response.status}`;
  try {
    const payload = (await response.json()) as { error?: string };
    message = payload.error ?? message;
  } catch {
    // Preserve the status-based message when the response is not JSON.
  }

  throw new Error(message);
}
