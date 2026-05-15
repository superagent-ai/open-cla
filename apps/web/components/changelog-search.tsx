"use client";

import type { ChangelogSearchItem } from "@/lib/changelog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";

type ChangelogSearchProps = {
  entries: ChangelogSearchItem[];
};

export function ChangelogSearch({ entries }: ChangelogSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut = event.key === "k" && (event.metaKey || event.ctrlKey);
      if (!isShortcut) {
        return;
      }

      event.preventDefault();
      setOpen((previous) => !previous);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function selectEntry(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
        <button
          aria-label="Search changelog"
          className="relative flex h-10 w-full max-w-md items-center gap-2 rounded-full bg-secondary px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Search className="h-4 w-4" />
          <span>Search changelog...</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <span aria-hidden="true">⌘</span>K
          </span>
        </button>
      </div>

      <div className="order-last w-full basis-full px-4 pb-3 md:hidden">
        <button
          aria-label="Search changelog"
          className="flex h-9 w-full items-center gap-2 rounded-full bg-secondary px-4 text-sm text-muted-foreground"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Search className="h-4 w-4" />
          <span>Search changelog...</span>
        </button>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search changelog"
        description="Search OpenCLA changelog entries"
        className="min-w-0 sm:max-w-lg"
      >
        <CommandInput placeholder="Search changelog..." />
        <CommandList>
          <CommandEmpty>No changelog entries found.</CommandEmpty>
          <CommandGroup heading="Changelog">
            {entries.map((entry) => (
              <CommandItem
                key={entry.id}
                value={entry.searchText}
                className="min-w-0"
                onSelect={() => selectEntry(entry.href)}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.title}</p>
                  {entry.date ? <p className="mt-1 text-xs text-muted-foreground">{entry.date}</p> : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
