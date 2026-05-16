"use client";

import type {
  AdminInstallation,
  AdminRepository,
  GlobalTemplateSummary,
  KnownGitHubUser
} from "@superagent-cla/shared";
import { ExternalLink, FileText, GitBranch, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";

type SearchCommandProps = {
  apiBaseUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type SearchData = {
  repos: AdminRepository[];
  templates: GlobalTemplateSummary[];
  users: KnownGitHubUser[];
};

export function SearchCommand({ apiBaseUrl, open, onOpenChange }: SearchCommandProps) {
  const router = useRouter();
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    function loadJson<T>(response: Response): Promise<T> {
      if (!response.ok) {
        return Promise.reject(new Error(`Request failed (${response.status})`));
      }
      return response.json() as Promise<T>;
    }

    Promise.all([
      fetch(`${apiBaseUrl}/api/admin/installations`, { credentials: "include" }).then(
        loadJson<{ installations: AdminInstallation[] }>
      ),
      fetch(`${apiBaseUrl}/api/admin/templates`, { credentials: "include" }).then(
        loadJson<{ templates: GlobalTemplateSummary[] }>
      ),
      fetch(`${apiBaseUrl}/api/admin/users`, { credentials: "include" }).then(
        loadJson<{ users: KnownGitHubUser[] }>
      )
    ])
      .then(([installations, templates, users]) => {
        if (cancelled) return;
        const repos = installations.installations.flatMap(
          (installation) => installation.repositories
        );
        setData({
          repos,
          templates: templates.templates,
          users: users.users
        });
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load search data");
      })
      .finally(() => {
        // Always clear loading—even if the effect cleaned up mid-flight (Strict Mode or dialog
        // closed while fetching). Keeping `loading === true` would block retries forever due to the
        // guard at the top of this effect.
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, data, apiBaseUrl]);

  const select = useCallback(
    (run: () => void) => {
      onOpenChange(false);
      run();
    },
    [onOpenChange]
  );

  const groupedTemplates = useMemo(() => {
    const defaults: GlobalTemplateSummary[] = [];
    const mine: GlobalTemplateSummary[] = [];
    for (const template of data?.templates ?? []) {
      if (template.source === "default") {
        defaults.push(template);
      } else {
        mine.push(template);
      }
    }
    return { defaults, mine };
  }, [data]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="min-w-0 sm:max-w-lg"
    >
      <CommandInput placeholder="Search repos, templates, users..." />
      <CommandList>
        {loading ? <SearchCommandSkeleton /> : null}
        {error ? <CommandEmpty>{error}</CommandEmpty> : null}
        {!loading && !error ? <CommandEmpty>No results found.</CommandEmpty> : null}

        {data?.repos.length ? (
          <>
            <CommandGroup heading="Repositories">
              {data.repos.map((repository) => (
                <CommandItem
                  key={`repo-${repository.repositoryId}`}
                  value={`repo ${repository.fullName} ${repository.owner} ${repository.name}`}
                  className="min-w-0"
                  onSelect={() =>
                    select(() => router.push(`/?repositoryId=${repository.repositoryId}`))
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{repository.fullName}</span>
                    </div>
                    <span className="w-36 shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground">
                      {repository.private ? "Private" : "Public"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        {groupedTemplates.mine.length || groupedTemplates.defaults.length ? (
          <>
            <CommandGroup heading="Templates">
              {[...groupedTemplates.mine, ...groupedTemplates.defaults].map((template) => (
                <CommandItem
                  key={`template-${template.templateId}`}
                  value={`template ${template.name} ${template.description ?? ""}`}
                  className="min-w-0"
                  onSelect={() =>
                    select(() => {
                      if (template.isMine) {
                        router.push(`/templates/${template.templateId}/edit`);
                      } else if (template.source === "default") {
                        router.push(`/templates/${template.templateId}`);
                      } else {
                        router.push("/templates");
                      }
                    })
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{template.name}</span>
                    </div>
                    <span className="w-36 shrink-0 text-right text-xs capitalize whitespace-nowrap text-muted-foreground">
                      {template.source}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        {data?.users.length ? (
          <CommandGroup heading="Users">
            {data.users.map((user) => (
              <CommandItem
                key={`user-${user.githubUserId}`}
                value={`user ${user.login}`}
                className="min-w-0"
                onSelect={() => select(() => window.open(`https://github.com/${user.login}`, "_blank"))}
              >
                <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {user.avatarUrl ? (
                      <img
                        alt={user.login}
                        className="size-4 shrink-0 rounded-full object-cover"
                        src={user.avatarUrl}
                      />
                    ) : (
                      <User className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">@{user.login}</span>
                  </div>
                  <span className="flex w-36 shrink-0 items-center justify-end gap-1 text-right text-xs whitespace-nowrap text-muted-foreground">
                    {user.signatureCount} signature{user.signatureCount === 1 ? "" : "s"}
                    <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

function SearchCommandSkeleton() {
  return (
    <>
      <CommandGroup heading="Repositories">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`repo-skeleton-${index}`} className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Templates">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`template-skeleton-${index}`} className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Users">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`user-skeleton-${index}`} className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-20 shrink-0" />
          </div>
        ))}
      </CommandGroup>
    </>
  );
}
