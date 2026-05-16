"use client";

import type { SigningPageResponse } from "@superagent-cla/shared";
import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SigningPageProps = {
  signing: SigningPageResponse;
  signedKind?: "personal" | "corporate" | null;
  error?: string | null;
};

type SigningKind = "personal" | "corporate";

const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1 className={cn("text-3xl font-semibold tracking-tight text-foreground", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn("mt-10 text-2xl font-semibold tracking-tight text-foreground", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-8 text-xl font-semibold tracking-tight text-foreground", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("mt-5 text-[15px] leading-7 text-muted-foreground", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-6 ml-6 list-disc space-y-2 text-[15px] text-muted-foreground", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-6 ml-6 list-decimal space-y-2 text-[15px] text-muted-foreground", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("pl-1 leading-7", className)} {...props} />,
  a: ({ className, ...props }) => (
    <a className={cn("font-medium text-foreground underline underline-offset-4", className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm font-medium text-foreground", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre className={cn("my-6 overflow-x-auto rounded-xl border border-border bg-muted/40 p-4", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn("mt-6 border-l-2 border-border pl-6 italic text-muted-foreground", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="my-6 overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th className={cn("border-b px-3 py-2 font-semibold text-foreground", className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-b px-3 py-2 text-muted-foreground", className)} {...props} />
  )
};

export function SigningPage({ signing, signedKind, error }: SigningPageProps) {
  const [signingKind, setSigningKind] = useState<SigningKind | null>(signedKind ?? null);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 md:py-16">
        <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-5">
            <a href="/" className="inline-flex items-center">
              <img src="/images/logo.webp" alt="OpenCLA" className="h-10 w-auto object-contain" />
            </a>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
                {signing.cla.title}
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                Review and sign the Contributor License Agreement for{" "}
                <span className="font-medium text-foreground">{signing.repository.fullName}</span>.
              </p>
            </div>
          </div>
          <div className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">
            Signed in as <span className="font-medium">@{signing.user.login}</span>
          </div>
        </header>

        {signedKind ? (
          <StatusMessage
            tone="success"
            title="CLA signature recorded"
            message={
              signedKind === "personal"
                ? "Your personal CLA signature has been recorded."
                : "The corporate CLA signature has been recorded."
            }
          />
        ) : null}

        {error ? (
          <StatusMessage tone="error" title="Unable to record signature" message={error} />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <Card className="gap-0 py-0">
            <CardContent className="px-6 py-6 md:px-8">
              {signing.cla.body.trim() ? (
                <article>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {signing.cla.body}
                  </ReactMarkdown>
                </article>
              ) : (
                <p className="text-sm text-muted-foreground">This CLA document has no body.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-8">
            <CardHeader>
              <CardTitle>Sign agreement</CardTitle>
              <p className="text-sm text-muted-foreground">Choose how you are signing before continuing.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3">
                <SigningChoiceButton
                  active={signingKind === "personal"}
                  description="I am signing as my GitHub user account."
                  label="Personal"
                  onClick={() => setSigningKind("personal")}
                />
                <SigningChoiceButton
                  active={signingKind === "corporate"}
                  description="I am authorized to sign for an organization."
                  label="Organization"
                  onClick={() => setSigningKind("corporate")}
                />
              </div>

              <div className="border-t pt-5">
                {signingKind === "personal" ? (
                  <form action="/sign/personal" method="post" className="space-y-4">
                    <HiddenSigningFields signing={signing} />
                    <p className="text-sm text-muted-foreground">
                      This records a CLA signature for <span className="font-medium text-foreground">@{signing.user.login}</span>.
                    </p>
                    <Button className="w-full" type="submit">
                      I agree and sign personally
                    </Button>
                  </form>
                ) : null}

                {signingKind === "corporate" ? (
                  <form action="/sign/corporate" method="post" className="space-y-4">
                    <HiddenSigningFields signing={signing} />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="orgLogin">
                        Organization login
                      </label>
                      <Input id="orgLogin" name="orgLogin" placeholder="acme" required />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      GitHub will verify that you are an owner of this organization.
                    </p>
                    <Button className="w-full" type="submit">
                      I agree on behalf of this organization
                    </Button>
                  </form>
                ) : null}

                {!signingKind ? (
                  <p className="text-sm text-muted-foreground">
                    Select a signing type above to see the required confirmation.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function SigningChoiceButton({
  active,
  description,
  label,
  onClick
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition-colors",
        active
          ? "border-ring bg-secondary text-foreground ring-3 ring-ring/20"
          : "border-border bg-background hover:bg-muted/60"
      )}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

function HiddenSigningFields({ signing }: { signing: SigningPageResponse }) {
  return (
    <>
      <input name="claDocumentId" type="hidden" value={signing.cla.documentId} />
      <input name="claVersionHash" type="hidden" value={signing.cla.versionHash} />
      <input name="owner" type="hidden" value={signing.context.owner} />
      <input name="repo" type="hidden" value={signing.context.repo} />
      <input name="pull" type="hidden" value={signing.context.pull ?? ""} />
      <input name="sha" type="hidden" value={signing.context.sha ?? ""} />
    </>
  );
}

function StatusMessage({
  tone,
  title,
  message
}: {
  tone: "success" | "error";
  title: string;
  message: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 opacity-90">{message}</p>
    </div>
  );
}

