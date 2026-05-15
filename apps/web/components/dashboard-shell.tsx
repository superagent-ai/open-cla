"use client";

import type { AdminUser } from "@superagent-cla/shared";
import {
  CircleHelp,
  Monitor,
  Moon,
  Search,
  Sun,
  UserCircle
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchCommand } from "@/components/search-command";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  apiBaseUrl: string;
  user: AdminUser;
  children: ReactNode;
};

export function DashboardShell({ apiBaseUrl, user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
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
  }, []);

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
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-[1536px] items-center gap-6 px-8">
          <div className="flex flex-1 items-center gap-8">
            <a href="/" className="flex items-center">
              <img src="/images/logo.webp" alt="OpenCLA" className="h-8 w-auto object-contain" />
            </a>
            <nav className="hidden items-center gap-3 text-base md:flex">
              <a
                aria-current={pathname === "/" ? "page" : undefined}
                className={cn(
                  "font-medium transition-colors",
                  pathname === "/" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                href="/"
              >
                Repos
              </a>
              <a
                aria-current={pathname === "/templates" ? "page" : undefined}
                className={cn(
                  "font-medium transition-colors",
                  pathname === "/templates"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                href="/templates"
              >
                Templates
              </a>
            </nav>
          </div>

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

          <div className="flex flex-1 items-center justify-end gap-4">
            <button
              className="hidden text-muted-foreground hover:text-foreground md:block"
              type="button"
            >
              <CircleHelp className="h-5 w-5" />
            </button>
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
                <button
                  className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  type="button"
                >
                  Support
                </button>
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
          </div>
        </div>
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
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-16 pt-16">{children}</div>

      <SearchCommand apiBaseUrl={apiBaseUrl} open={searchOpen} onOpenChange={setSearchOpen} />
    </main>
  );
}
