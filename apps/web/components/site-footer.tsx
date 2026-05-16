export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-background py-8">
      <div className="w-full px-4 md:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">&copy; 2026 Superagent Technologies Inc.</p>
          <a
            href="https://www.ycombinator.com/companies/superagent"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex size-6 items-center justify-center rounded bg-[#ff5a1f] text-xs font-semibold text-white">
              Y
            </span>
            <span>Backed by Y Combinator</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
