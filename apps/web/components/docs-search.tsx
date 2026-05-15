"use client";

import type { DocSearchItem } from "@/lib/docs";
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

type DocsSearchProps = {
  docs: DocSearchItem[];
};

export function DocsSearch({ docs }: DocsSearchProps) {
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

  function selectDoc(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
        <button
          aria-label="Search documentation"
          className="relative flex h-10 w-full max-w-md items-center gap-2 rounded-full bg-secondary px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Search className="h-4 w-4" />
          <span>Search docs...</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <span aria-hidden="true">⌘</span>K
          </span>
        </button>
      </div>

      <div className="order-last w-full basis-full px-4 pb-3 md:hidden">
        <button
          aria-label="Search documentation"
          className="flex h-9 w-full items-center gap-2 rounded-full bg-secondary px-4 text-sm text-muted-foreground"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Search className="h-4 w-4" />
          <span>Search docs...</span>
        </button>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search documentation"
        description="Search OpenCLA documentation"
        className="min-w-0 sm:max-w-lg"
      >
        <CommandInput placeholder="Search documentation..." />
        <CommandList>
          <CommandEmpty>No docs found.</CommandEmpty>
          <CommandGroup heading="Documentation">
            {docs.map((doc) => (
              <CommandItem
                key={doc.slug}
                value={doc.searchText}
                className="min-w-0"
                onSelect={() => selectDoc(doc.href)}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {doc.description}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
