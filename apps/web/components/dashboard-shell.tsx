"use client";

import type { AdminUser } from "@superagent-cla/shared";
import { Monitor, Moon, Search, Sun, UserCircle } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ChangelogSearch } from "@/components/changelog-search";
import { DocsSearch } from "@/components/docs-search";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchCommand } from "@/components/search-command";
import { SiteFooter } from "@/components/site-footer";
import { githubLoginUrl } from "@/lib/api-public";
import type { ChangelogSearchItem } from "@/lib/changelog";
import type { DocSearchItem } from "@/lib/docs";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  apiBaseUrl: string;
  user: AdminUser | null;
  children: ReactNode;
  /** When set, the header uses documentation search instead of the repo/template command palette. */
  docsSearchItems?: DocSearchItem[];
  /** When set, the header uses changelog search instead of the repo/template command palette. */
  changelogSearchItems?: ChangelogSearchItem[];
  /**
   * Use the same header layout as docs (spacing, no repo command palette) but omit docs search — e.g. `/changelog`.
   */
  docsHeaderWithoutSearch?: boolean;
  /** Override the default content wrapper (max width + padding). Use for full-width layouts like `/docs`. */
  contentClassName?: string;
};

export function DashboardShell({
  apiBaseUrl,
  user,
  children,
  docsSearchItems,
  changelogSearchItems,
  docsHeaderWithoutSearch,
  contentClassName
}: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const docsLikeHeader = docsSearchItems !== undefined || changelogSearchItems !== undefined || docsHeaderWithoutSearch === true;
  const isReposActive = pathname === "/";
  const isTemplatesActive = pathname === "/templates" || pathname.startsWith("/templates/");
  const isDocsActive = pathname === "/docs" || pathname.startsWith("/docs/");
  const loginReturnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const [themeMounted, setThemeMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    if (docsLikeHeader) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut = event.key === "k" && (event.metaKey || event.ctrlKey);
      if (!isShortcut) {
        return;
      }
      event.preventDefault();
      setSearchOpen((prev) => !prev);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [docsLikeHeader]);

  const currentTheme = themeMounted ? theme : undefined;

  async function logout() {
    setPending(true);
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      window.location.href = "/";
    } catch {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div
          className={cn(
            "flex w-full items-center gap-6 px-8",
            docsLikeHeader ? "min-h-16 flex-wrap py-2 md:h-16 md:flex-nowrap md:py-0" : "h-16"
          )}
        >
          <div className="flex flex-1 items-center gap-8">
            <a href="/" className="flex items-center">
              <img src="/images/logo.webp" alt="OpenCLA" className="h-8 w-auto object-contain" />
            </a>
            <nav className="hidden items-center gap-3 text-base md:flex">
              <a
                aria-current={isReposActive ? "page" : undefined}
                className={cn(
                  "font-medium transition-colors",
                  isReposActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                href="/"
              >
                Repos
              </a>
              <a
                aria-current={isTemplatesActive ? "page" : undefined}
                className={cn(
                  "font-medium transition-colors",
                  isTemplatesActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                href="/templates"
              >
                Templates
              </a>
              <a
                aria-current={isDocsActive ? "page" : undefined}
                className={cn(
                  "font-medium transition-colors",
                  isDocsActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                href="/docs"
              >
                Docs
              </a>
            </nav>
          </div>

          {docsSearchItems ? (
            <DocsSearch docs={docsSearchItems} />
          ) : changelogSearchItems ? (
            <ChangelogSearch entries={changelogSearchItems} />
          ) : docsHeaderWithoutSearch ? (
            <div className="hidden min-w-0 flex-1 md:block" aria-hidden="true" />
          ) : (
            <button
              aria-label="Open search"
              className="relative hidden h-10 w-full max-w-md items-center gap-2 rounded-full bg-secondary px-4 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search className="h-4 w-4" />
              <span>Search repos, templates, users...</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <span aria-hidden="true">⌘</span>K
              </span>
            </button>
          )}

          <div className="flex flex-1 items-center justify-end gap-4">
            {user ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Open account menu"
                    className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-secondary"
                    disabled={pending}
                    type="button"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.login}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="block w-52 gap-0 p-0 [&>*]:m-0"
                >
                  <div className="px-4 pb-3 pt-4">
                    <p className="text-sm font-medium leading-tight text-foreground">@{user.login}</p>
                    <p className="mt-1 text-sm text-muted-foreground">GitHub account</p>
                  </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between px-4 py-3 text-sm text-foreground">
                  <span>Theme</span>
                  <div className="flex rounded-full bg-secondary p-1">
                    <button
                      aria-label="Light theme"
                      aria-pressed={currentTheme === "light"}
                      className={cn(
                        "rounded-full p-1.5 transition-colors",
                        currentTheme === "light"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setTheme("light")}
                      type="button"
                    >
                      <Sun className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Dark theme"
                      aria-pressed={currentTheme === "dark"}
                      className={cn(
                        "rounded-full p-1.5 transition-colors",
                        currentTheme === "dark"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setTheme("dark")}
                      type="button"
                    >
                      <Moon className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="System theme"
                      aria-pressed={currentTheme === "system"}
                      className={cn(
                        "rounded-full p-1.5 transition-colors",
                        currentTheme === "system"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setTheme("system")}
                      type="button"
                    >
                      <Monitor className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <Link
                  className="flex w-full items-center px-4 py-3 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                  href="/changelog"
                >
                  Changelog
                </Link>
                <div className="h-px bg-border" />
                <Link
                  className="flex w-full items-center px-4 py-3 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                  href="/docs"
                >
                  Documentation
                </Link>
                <div className="h-px bg-border" />
                <button
                  className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  disabled={pending}
                  onClick={() => void logout()}
                  type="button"
                >
                  Log out
                </button>
                <div className="h-px bg-border" />
                <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                  <a href="https://www.superagent.sh/legal/privacy-policy">Privacy</a>
                  <a href="https://www.superagent.sh/legal/dashboard-terms">Terms</a>
                  <a href="https://www.superagent.sh/legal">Legal</a>
                </div>
              </PopoverContent>
            </Popover>
            ) : (
              <Link
                href={githubLoginUrl(loginReturnTo)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
              >
                Login
              </Link>
            )}
          </div>
        </div>
        {!docsLikeHeader ? (
          <div className="border-t border-border px-4 py-2 md:hidden">
            <button
              aria-label="Open search"
              className="flex h-9 w-full items-center gap-2 rounded-full bg-secondary px-4 text-sm text-muted-foreground"
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search className="h-4 w-4" />
              <span>Search...</span>
            </button>
          </div>
        ) : null}
      </header>

      <div
        className={
          contentClassName ??
          "mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-16"
        }
      >
        {children}
      </div>

      <SiteFooter />

      {docsLikeHeader ? null : (
        <SearchCommand apiBaseUrl={apiBaseUrl} open={searchOpen} onOpenChange={setSearchOpen} />
      )}
    </main>
  );
}
