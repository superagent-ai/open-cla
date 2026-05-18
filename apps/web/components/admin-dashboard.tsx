"use client";

import type {
  AdminInstallation,
  AdminRepository,
  AdminUser,
  SignaturesResponse,
  TemplatesResponse
} from "@superagent-cla/shared";
import { ArrowUpRightIcon, FolderCode, Lock } from "lucide-react";
import { ditherAvatarDataUri } from "dither-avatar";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { RepositoryDetailPanel } from "@/components/repository-detail-panel";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";

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

  const repositories = useMemo(
    () => installations.flatMap((installation) => installation.repositories),
    [installations]
  );

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      {!selectedRepositoryId || !templatesResponse ? (
        <section className="space-y-6">
          {repositories.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderCode />
                </EmptyMedia>
                <EmptyTitle>No Repositories Yet</EmptyTitle>
                <EmptyDescription>
                  Install the OpenCLA GitHub App on a repository to start enforcing CLA checks.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center">
                <Button asChild>
                  <a href="https://github.com/apps/open-cla">
                    Install GitHub App
                    <ArrowUpRightIcon className="h-4 w-4" />
                  </a>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {repositories.map((repository) => (
                <button
                  key={repository.repositoryId}
                  type="button"
                  onClick={() => router.push(`/?repositoryId=${repository.repositoryId}`)}
                  className="group flex cursor-pointer flex-col gap-3 rounded-2xl text-left transition-transform hover:-translate-y-0.5"
                >
                  <RepositoryCard repository={repository} />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <RepositoryDetailPanel
          signaturesResponse={signaturesResponse}
          templatesResponse={templatesResponse}
          onNavigateBack={() => router.push("/")}
        />
      )}
    </DashboardShell>
  );
}

function RepositoryCard({ repository }: { repository: AdminRepository }) {
  return (
    <>
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
    </>
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
  if (stats.signingMode === "dropbox_sign") {
    parts.push("Dropbox Sign");
  }

  return parts.join(" · ");
}
