"use client";

import type {
  AdminInstallation,
  AdminRepository,
  AdminUser,
  SignaturesResponse,
  TemplatesResponse
} from "@superagent-cla/shared";
import { Lock } from "lucide-react";
import { ditherAvatarDataUri } from "dither-avatar";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { RepositoryDetailPanel } from "@/components/repository-detail-panel";

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
      await fetch(`/api/admin/repositories/${selectedRepositoryId}/template-selection`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryId: selectedRepositoryId, templateVersionId })
      }).then(assertOk);
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to select template";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!selectedRepositoryId || !templatesResponse ? (
        <section className="space-y-6">
          {repositories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No installed repositories where you have admin access.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {repositories.map((repository) => (
                <button
                  key={repository.repositoryId}
                  type="button"
                  onClick={() => router.push(`/?repositoryId=${repository.repositoryId}`)}
                  className="group flex cursor-pointer flex-col gap-3 rounded-2xl text-left transition-transform hover:-translate-y-0.5"
                >
                  <div
                    className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-muted"
                    style={{
                      backgroundImage: `url("${ditherAvatarDataUri(repository.fullName)}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  >
                    <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/5">
                      {repository.private ? (
                        <>
                          <Lock className="h-3 w-3" />
                          Private
                        </>
                      ) : (
                        "Public"
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 px-1">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold uppercase">
                      {repository.owner.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{repository.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{describeRepositoryStats(repository)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <RepositoryDetailPanel
          pending={pending}
          signaturesResponse={signaturesResponse}
          templatesResponse={templatesResponse}
          onNavigateBack={() => router.push("/")}
          onSelectTemplate={(templateVersionId) => void selectTemplate(templateVersionId)}
        />
      )}
    </DashboardShell>
  );
}

function describeRepositoryStats(repository: AdminRepository): string {
  const stats = repository.stats;
  if (!stats) {
    return "No CLA activity yet";
  }

  const parts: string[] = [];
  parts.push(`${stats.signatureCount} ${stats.signatureCount === 1 ? "signature" : "signatures"}`);

  if (stats.templateMode === "managed" && stats.selectedTemplateName) {
    parts.push(`template: ${stats.selectedTemplateName}`);
  } else {
    parts.push("repository CLA.md");
  }

  return parts.join(" · ");
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
