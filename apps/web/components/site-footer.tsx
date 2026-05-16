import type { ReactNode } from "react";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background py-16">
      <div className="w-full px-4 md:px-8">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
          <div>
            <h4 className="mb-4 font-medium">Open Source</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <FooterLink href="https://www.superagent.sh/open-cla">Open CLA</FooterLink>
              <FooterLink href="https://www.superagent.sh/open-source/superagent-sdk">Superagent SDK</FooterLink>
              <FooterLink href="https://www.superagent.sh/open-source/vibekit">VibeKit</FooterLink>
              <FooterLink href="https://www.superagent.sh/open-source/grok-cli">Grok CLI</FooterLink>
              <FooterLink href="https://www.superagent.sh/open-source/reag">ReAG</FooterLink>
              <FooterLink href="https://www.superagent.sh/open-source/models">Models</FooterLink>
              <FooterLink href="https://www.superagent.sh/open-source/brin">Brin</FooterLink>
              <FooterLink href="https://www.superagent.sh/open-source/polyresearch">Polyresearch</FooterLink>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-medium">Resources</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <FooterLink href="/docs">Docs</FooterLink>
              <FooterLink href="https://www.superagent.sh/blog">Blog</FooterLink>
              <FooterLink href="https://www.superagent.sh/pact">The Pact</FooterLink>
              <FooterLink href="https://www.superagent.sh/customer-stories">Customer Stories</FooterLink>
              <FooterLink href="https://www.superagent.sh/lamb-bench">Lamb-Bench</FooterLink>
              <FooterLink href="https://www.superagent.sh/use-cases">Use Cases</FooterLink>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-medium">Community</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://github.com/superagent-ai"
                  className="transition-colors hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub{" "}
                  <span className="rounded-md bg-muted px-1 py-0.5 text-xs">10k {"\u2605"}</span>
                </a>
              </li>
              <FooterLink href="https://huggingface.co/superagent-ai">Hugging Face</FooterLink>
              <FooterLink href="https://discord.gg/spZ7MnqFT4">Discord</FooterLink>
              <FooterLink href="https://x.com/superagent_ai">X</FooterLink>
              <FooterLink href="https://www.linkedin.com/company/superagent-sh/">LinkedIn</FooterLink>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-medium">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <FooterLink href="https://www.superagent.sh/about">About</FooterLink>
              <FooterLink href="https://www.superagent.sh/legal">Legal</FooterLink>
              <FooterLink href="https://www.superagent.sh/legal/privacy-policy">Privacy</FooterLink>
              <FooterLink href="/">Sign in</FooterLink>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
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

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  const isExternal = href.startsWith("http");
  const className = "transition-colors hover:text-foreground";

  return (
    <li>
      {isExternal ? (
        <a href={href} className={className} target="_blank" rel="noreferrer">
          {children}
        </a>
      ) : (
        <Link href={href} className={className}>
          {children}
        </Link>
      )}
    </li>
  );
}
