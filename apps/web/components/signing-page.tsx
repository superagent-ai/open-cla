"use client";

import type { SigningPageResponse } from "@superagent-cla/shared";
import { Check, PenLine } from "lucide-react";
import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { signCorporateAction, signPersonalAction } from "@/lib/actions/signing";

import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

type SigningPageProps = {
  signing: SigningPageResponse;
  signedKind?: "personal" | "corporate" | null;
  dropboxSignedKind?: "personal" | "corporate" | null;
  dropboxEmailSentKind?: "personal" | "corporate" | null;
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

export function SigningPage({
  signing,
  signedKind,
  dropboxSignedKind,
  dropboxEmailSentKind,
  error
}: SigningPageProps) {
  const isDropboxTemplate = signing.cla.contentFormat === "dropbox_template";
  const [signingKind, setSigningKind] = useState<SigningKind | null>(
    signedKind ?? (isDropboxTemplate ? "personal" : null)
  );
  const requiresDropboxSign = signing.signingMode === "dropbox_sign";
  const signingDisabled = requiresDropboxSign && !signing.dropboxSignConfigured;
  const pullNumber = signing.context.pull?.trim() || null;
  const dropboxColumnClass = "mx-auto w-full max-w-lg";

  const signedInBadge = (
    <div className="shrink-0 whitespace-nowrap rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">
      Signed in as <span className="font-medium">@{signing.user.login}</span>
    </div>
  );

  const titleAndSubtitle = (
    <div className={cn("space-y-3", isDropboxTemplate && "w-full")}>
      <h1
        className={cn(
          "font-semibold tracking-tight",
          isDropboxTemplate ? "text-2xl md:text-3xl" : "max-w-3xl text-3xl md:text-4xl"
        )}
      >
        {signing.cla.title}
      </h1>
      <p className={cn("w-full text-base text-muted-foreground", !isDropboxTemplate && "max-w-2xl")}>
        {isDropboxTemplate ? (
          <>
            Complete the Contributor License Agreement for{" "}
            <span className="font-medium text-foreground">{signing.repository.fullName}</span>
            {pullNumber ? (
              <>
                {" "}
                to unblock{" "}
                <a
                  className="font-medium text-foreground underline underline-offset-4"
                  href={`https://github.com/${signing.repository.fullName}/pull/${pullNumber}`}
                >
                  pull request #{pullNumber}
                </a>
              </>
            ) : (
              "."
            )}
          </>
        ) : (
          <>
            Review and sign the Contributor License Agreement for{" "}
            <span className="font-medium text-foreground">{signing.repository.fullName}</span>.
          </>
        )}
      </p>
    </div>
  );

  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 md:py-16">
          <header
            className={cn(
              isDropboxTemplate
                ? cn(dropboxColumnClass, "flex flex-col gap-5")
                : "flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
            )}
          >
            {isDropboxTemplate ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <a href="/" className="inline-flex items-center">
                    <img src="/images/logo.webp" alt="OpenCLA" className="h-10 w-auto object-contain" />
                  </a>
                  {signedInBadge}
                </div>
                {titleAndSubtitle}
              </>
            ) : (
              <>
                <div className="min-w-0 space-y-5">
                  <a href="/" className="inline-flex items-center">
                    <img src="/images/logo.webp" alt="OpenCLA" className="h-10 w-auto object-contain" />
                  </a>
                  {titleAndSubtitle}
                </div>
                {signedInBadge}
              </>
            )}
          </header>

          {signedKind ? (
            <StatusMessage
              className={isDropboxTemplate ? dropboxColumnClass : undefined}
              tone="success"
              title="CLA signature recorded"
              message={
                signedKind === "personal"
                  ? "Your personal CLA signature has been recorded."
                  : "The corporate CLA signature has been recorded."
              }
            />
          ) : null}

          {dropboxEmailSentKind ? (
            <StatusMessage
              className={isDropboxTemplate ? dropboxColumnClass : undefined}
              tone="success"
              title="Check your email"
              message={
                dropboxEmailSentKind === "personal"
                  ? "Dropbox Sign emailed you a signing link. Open it to complete your CLA, then return here or to your pull request."
                  : "Dropbox Sign emailed you a signing link. Open it to complete the corporate CLA, then return here or to your pull request."
              }
            />
          ) : null}

          {dropboxSignedKind ? (
            <StatusMessage
              className={isDropboxTemplate ? dropboxColumnClass : undefined}
              tone="success"
              title="Signature submitted"
              message={
                dropboxSignedKind === "personal"
                  ? "Dropbox Sign received your signature. CLA coverage will update shortly and your pull request check will re-run."
                  : "Dropbox Sign received the corporate signature. CLA coverage will update shortly and your pull request check will re-run."
              }
            />
          ) : null}

          {error ? (
            <StatusMessage
              className={isDropboxTemplate ? dropboxColumnClass : undefined}
              tone="error"
              title="Unable to record signature"
              message={error}
            />
          ) : null}

          <div
            className={cn(
              "grid gap-6",
              isDropboxTemplate ? dropboxColumnClass : "lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
            )}
          >
            {!isDropboxTemplate && signing.cla.contentFormat === "pdf" && signing.cla.pdfUrl ? (
              <iframe
                className="h-[min(75vh,900px)] w-full"
                src={signing.cla.pdfUrl}
                title={signing.cla.title}
              />
            ) : !isDropboxTemplate ? (
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
            ) : null}

            <Card
              className={cn(
                !isDropboxTemplate && "lg:sticky lg:top-8",
                requiresDropboxSign &&
                  "border-teal-200/60 shadow-md shadow-teal-600/5 dark:border-teal-800/40 dark:shadow-teal-950/20"
              )}
            >
              <CardHeader className="space-y-3">
                {requiresDropboxSign ? (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-900 dark:border-teal-700/60 dark:bg-teal-500/15 dark:text-teal-100">
                    <PenLine className="size-3.5 shrink-0" aria-hidden />
                    Dropbox Sign
                  </span>
                ) : null}
                <div className="space-y-1.5">
                  <CardTitle>Sign agreement</CardTitle>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {requiresDropboxSign
                      ? "Dropbox Sign will email you a signing link after you continue."
                      : "Choose how you are signing before continuing."}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {signingDisabled ? (
                  <StatusMessage
                    tone="error"
                    title="Dropbox Sign unavailable"
                    message="This repository requires Dropbox Sign, but the deployment is not configured for it."
                  />
                ) : null}

                {isDropboxTemplate ? (
                  <p className="text-sm font-medium text-foreground">How are you signing?</p>
                ) : null}
                <div
                  className={cn(
                    "grid gap-2.5",
                    requiresDropboxSign && "rounded-xl bg-teal-500/[0.04] p-2 ring-1 ring-inset ring-teal-500/10"
                  )}
                >
                  <SigningChoiceButton
                    accent={requiresDropboxSign}
                    active={signingKind === "personal"}
                    description="I am signing as my GitHub user account."
                    label="Personal"
                    onClick={() => setSigningKind("personal")}
                  />
                  <SigningChoiceButton
                    accent={requiresDropboxSign}
                    active={signingKind === "corporate"}
                    description="I am authorized to sign for an organization."
                    label="Organization"
                    onClick={() => setSigningKind("corporate")}
                  />
                </div>

                <div className={cn("border-t pt-5", requiresDropboxSign && "border-teal-200/40 dark:border-teal-800/30")}>
                  {signingKind === "personal" ? (
                    <form action={signPersonalAction} className="space-y-4">
                      <HiddenSigningFields signing={signing} />
                      {requiresDropboxSign ? <SignerEmailField /> : null}
                      <p className="text-sm text-muted-foreground">
                        {requiresDropboxSign ? (
                          <>
                            Dropbox Sign will collect the auditable e-signature for{" "}
                            <span className="font-medium text-foreground">@{signing.user.login}</span>.
                          </>
                        ) : (
                          <>
                            This records a CLA signature for{" "}
                            <span className="font-medium text-foreground">@{signing.user.login}</span>.
                          </>
                        )}
                      </p>
                      <SubmitButton
                        className="w-full"
                        disabled={signingDisabled}
                        pendingLabel={requiresDropboxSign ? "Continuing…" : "Signing…"}
                      >
                        {requiresDropboxSign ? "Email me a signing link" : "I agree and sign personally"}
                      </SubmitButton>
                    </form>
                  ) : null}

                  {signingKind === "corporate" ? (
                    <form action={signCorporateAction} className="space-y-4">
                      <HiddenSigningFields signing={signing} />
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="orgLogin">
                          Organization login
                        </label>
                        <Input id="orgLogin" name="orgLogin" placeholder="acme" required />
                      </div>
                      {requiresDropboxSign ? <SignerEmailField /> : null}
                      <p className="text-sm text-muted-foreground">
                        {requiresDropboxSign
                          ? "GitHub will verify that you are an owner of this organization before Dropbox Sign collects the signature."
                          : "GitHub will verify that you are an owner of this organization."}
                      </p>
                      <SubmitButton
                        className="w-full"
                        disabled={signingDisabled}
                        pendingLabel="Continuing…"
                      >
                        {requiresDropboxSign
                          ? "Email me a signing link"
                          : "I agree on behalf of this organization"}
                      </SubmitButton>
                    </form>
                  ) : null}

                  {!signingKind && !isDropboxTemplate ? (
                    <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-center text-sm text-muted-foreground">
                      Select a signing type above to continue.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SigningChoiceButton({
  accent,
  active,
  description,
  label,
  onClick
}: {
  accent?: boolean;
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "w-full rounded-xl border px-4 py-3 text-left transition-all",
        accent
          ? active
            ? "border-teal-600/35 bg-card shadow-sm ring-2 ring-teal-500/25 dark:border-teal-500/40 dark:ring-teal-500/20"
            : "border-border/70 bg-card/80 hover:border-teal-500/25 hover:bg-card"
          : active
            ? "border-ring bg-secondary text-foreground ring-3 ring-ring/20"
            : "border-border bg-background hover:bg-muted/60"
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="mt-1 block text-sm leading-snug text-muted-foreground">{description}</span>
        </span>
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            active
              ? accent
                ? "border-teal-600 bg-teal-600 text-white dark:border-teal-500 dark:bg-teal-500"
                : "border-emerald-500 bg-emerald-500 text-white"
              : "border-border bg-background"
          )}
          aria-hidden
        >
          {active ? <Check className="size-3.5" /> : null}
        </span>
      </span>
    </button>
  );
}

function HiddenSigningFields({ signing }: { signing: SigningPageResponse }) {
  return (
    <>
      <input name="claDocumentId" type="hidden" value={signing.cla.documentId} />
      <input name="claVersionHash" type="hidden" value={signing.cla.versionHash} />
      <input name="claTitle" type="hidden" value={signing.cla.title} />
      <input name="owner" type="hidden" value={signing.context.owner} />
      <input name="repo" type="hidden" value={signing.context.repo} />
      <input name="pull" type="hidden" value={signing.context.pull ?? ""} />
      <input name="sha" type="hidden" value={signing.context.sha ?? ""} />
    </>
  );
}

function SignerEmailField() {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor="signerEmail">
        Email for Dropbox Sign
      </label>
      <Input
        className="bg-background"
        id="signerEmail"
        name="signerEmail"
        placeholder="you@example.com"
        required
        type="email"
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Dropbox Sign requires an email address for the signer record and audit trail.
      </p>
    </div>
  );
}

function StatusMessage({
  className,
  tone,
  title,
  message
}: {
  className?: string;
  tone: "success" | "error";
  title: string;
  message: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        className,
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

