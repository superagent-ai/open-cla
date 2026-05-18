"use client";

import type {
  ClaDocumentSource,
  RepositorySigningMode,
  SignatureRecord,
  SignaturesResponse,
  TemplateSummary,
  TemplatesResponse
} from "@superagent-cla/shared";
import { Check, ChevronsUpDown, ExternalLink, Loader } from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction
} from "react";

import {
  saveDropboxSignIntegrationAction,
  updateSigningModeAction,
  updateTemplateSelectionAction
} from "@/lib/actions/admin-repository";
import type { RepositoryActionResult } from "@/lib/actions/types";
import { emptyRepositoryActionResult } from "@/lib/actions/types";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RepositoryDetailPanelProps = {
  templatesResponse: TemplatesResponse;
  signaturesResponse: SignaturesResponse | null;
  onNavigateBack: () => void;
};

export function RepositoryDetailPanel({
  templatesResponse: initialTemplatesResponse,
  signaturesResponse,
  onNavigateBack
}: RepositoryDetailPanelProps) {
  const [templatesResponse, setTemplatesResponse] = useState(initialTemplatesResponse);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const repositoryId = templatesResponse.repository.repositoryId;
  const saveDropboxAction = saveDropboxSignIntegrationAction.bind(null, repositoryId);
  const [dropboxState, dropboxFormAction, dropboxPending] = useActionState(
    saveDropboxAction,
    emptyRepositoryActionResult()
  );

  useEffect(() => {
    setTemplatesResponse(initialTemplatesResponse);
  }, [initialTemplatesResponse]);

  useEffect(() => {
    applyRepositoryPatch(dropboxState, setTemplatesResponse);
  }, [dropboxState]);

  const pending = isPending || dropboxPending;
  const error = actionError ?? dropboxState.error;

  function runRepositoryMutation(work: () => Promise<RepositoryActionResult>): void {
    setActionError(null);
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        setActionError(result.error);
        return;
      }
      applyRepositoryPatch(result, setTemplatesResponse);
    });
  }

  const repo = templatesResponse.repository;
  const settings = templatesResponse.settings;
  const { defaultTemplates, globalCustomTemplates, repoCustomTemplates } = useMemo(
    () => splitTemplates(templatesResponse.templates, repo.repositoryId),
    [templatesResponse.templates, repo.repositoryId]
  );

  const signatureGroups = useMemo(
    () => groupSignatures(signaturesResponse?.signatures ?? []),
    [signaturesResponse?.signatures]
  );

  const isRepositoryFilePolicy = settings.mode === "repository";
  const managedVersionId = settings.mode === "managed" ? settings.selectedTemplateVersionId : null;
  const signingSettings = templatesResponse.signingSettings;
  const [showDropboxCredentials, setShowDropboxCredentials] = useState(
    signingSettings.signingMode === "dropbox_sign"
  );
  const [draftSigningMode, setDraftSigningMode] = useState<RepositorySigningMode | null>(null);
  const visibleSigningMode = draftSigningMode ?? signingSettings.signingMode;

  return (
    <section className="space-y-12">
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <header className="space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button type="button" onClick={onNavigateBack}>
                  Repositories
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{repo.fullName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-1">
          <div className="inline-flex max-w-full items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{templatesResponse.repository.fullName}</h1>
            <a
              aria-label={`Open ${templatesResponse.repository.fullName} on GitHub`}
              className="inline-flex shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              href={`https://github.com/${repo.owner}/${repo.name}`}
              rel="noreferrer noopener"
              target="_blank"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            {settings.mode === "repository" ? (
              <>
                Using <Badge variant="secondary">CLA.md</Badge> in the repository · Admin managed templates are off
              </>
            ) : (
              <>
                Managed template · <span className="font-medium text-foreground">{settings.selectedTemplateName ?? "—"}</span>
                {settings.selectedTemplateHash ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    ({settings.selectedTemplateHash.slice(0, 12)})
                  </span>
                ) : null}
              </>
            )}
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">CLA policy</h2>
          <p className="text-sm text-muted-foreground">
            CLA.md, built‑in defaults, or latest uploaded template.{" "}
            <Link className="font-medium text-foreground underline underline-offset-4 hover:no-underline" href="/templates">
              Manage templates
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ClaPolicySearchableSelect
            defaultTemplates={defaultTemplates}
            globalCustomTemplates={globalCustomTemplates}
            isRepositoryFilePolicy={isRepositoryFilePolicy}
            managedVersionId={managedVersionId}
            pending={pending}
            repoCustomTemplates={repoCustomTemplates}
            settings={settings}
            onSelectTemplate={(templateVersionId) =>
              runRepositoryMutation(() =>
                updateTemplateSelectionAction(repositoryId, templateVersionId)
              )
            }
          />
          {pending ? (
            <Loader
              aria-label="Updating CLA policy"
              className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Signing method</h2>
          <p className="text-sm text-muted-foreground">
            Use simple OpenCLA acceptance by default, or require Dropbox Sign for this repository.
          </p>
        </div>

        <div className="grid max-w-3xl gap-3 md:grid-cols-2">
          <SigningModeButton
            active={visibleSigningMode === "simple"}
            description="Contributors accept the CLA directly in OpenCLA."
            disabled={pending}
            label="Simple acceptance"
            onClick={() => {
              setDraftSigningMode(null);
              setShowDropboxCredentials(false);
              runRepositoryMutation(() => updateSigningModeAction(repositoryId, "simple"));
            }}
          />
          <SigningModeButton
            active={visibleSigningMode === "dropbox_sign"}
            description={
              signingSettings.dropboxSignConfigured
                ? "Contributors sign the CLA using Dropbox Sign."
                : "Contributors will sign using Dropbox Sign after credentials are added."
            }
            disabled={pending}
            label="Dropbox Sign"
            onClick={() => {
              setDraftSigningMode("dropbox_sign");
              setShowDropboxCredentials(true);
              if (signingSettings.dropboxSignConfigured) {
                runRepositoryMutation(() => updateSigningModeAction(repositoryId, "dropbox_sign"));
              }
            }}
          />
        </div>
        {showDropboxCredentials || signingSettings.signingMode === "dropbox_sign" ? (
          <DropboxSignCredentialsForm
            action={dropboxFormAction}
            apiKeyLast4={signingSettings.dropboxSignApiKeyLast4}
            callbackUrl={signingSettings.dropboxSignCallbackUrl}
            pending={pending}
          />
        ) : null}
      </section>

      {signaturesResponse ? (
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">Signatures</h2>
            <p className="text-sm text-muted-foreground">
              Grouped by the agreement document signed. Historical hashes may appear if wording changed between
              commits.
            </p>
          </div>

          {signatureGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signatures for this repository yet.</p>
          ) : (
            <div className="space-y-6">
              {signatureGroups.map((group) => (
                <article key={group.key} className="overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10">
                  <div className="border-b bg-muted/30 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{group.documentLabel}</span>
                      <Badge variant="outline" className="font-normal capitalize">
                        {documentSourceBadge(group.documentSource)}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Hash {group.claVersionHash.slice(0, 12)}
                      </span>
                      <Badge variant="secondary" className="ml-auto shrink-0">
                        {group.signatures.length}{" "}
                        {group.signatures.length === 1 ? "signer" : "signers"}
                      </Badge>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Signer</TableHead>
                        <TableHead>Kind</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Signed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.signatures.map((signature) => (
                        <TableRow
                          key={`${signature.kind}-${signature.signerLogin}-${signature.signedAt}-${signature.claVersionHash}`}
                        >
                          <TableCell className="font-medium">@{signature.signerLogin}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{signature.kind}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {signature.organizationLogin ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(signature.signedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {signaturesResponse ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">Pull request checks</h2>
            <p className="text-sm text-muted-foreground">Recent GitHub CLA check runs for this repository.</p>
          </div>
          {signaturesResponse.pullRequestChecks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No check records yet.</p>
          ) : (
            <div className="rounded-lg border bg-card ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PR</TableHead>
                    <TableHead>SHA</TableHead>
                    <TableHead>Conclusion</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signaturesResponse.pullRequestChecks.map((check) => (
                    <TableRow key={`${check.pullNumber}-${check.headSha}`}>
                      <TableCell className="font-medium">#{check.pullNumber}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {check.headSha.slice(0, 7)}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{check.conclusion ?? "pending"}</TableCell>
                      <TableCell className="text-muted-foreground">{check.lastSummary ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {check.detailsUrl ? (
                          <a
                            href={check.detailsUrl}
                            className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            Details
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}

function SigningModeButton({
  active,
  description,
  disabled,
  label,
  onClick
}: {
  active: boolean;
  description: string;
  disabled: boolean;
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
          : "border-border bg-background hover:bg-muted/60",
        disabled ? "cursor-not-allowed opacity-60" : ""
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="block text-sm font-medium">{label}</span>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border",
            active
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-border text-transparent"
          )}
          aria-hidden="true"
        >
          <Check className="size-3.5" />
        </span>
      </span>
      <span className="mt-1 block pr-8 text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

function DropboxSignCredentialsForm({
  action,
  apiKeyLast4,
  callbackUrl,
  pending
}: {
  action: (formData: FormData) => void;
  apiKeyLast4: string | null;
  callbackUrl: string;
  pending: boolean;
}) {
  return (
    <form action={action} className="max-w-3xl rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">Dropbox Sign credentials</h3>
        <p className="text-sm text-muted-foreground">
          Store the repository owner&apos;s Dropbox Sign API key. The key is encrypted at rest.
        </p>
        {apiKeyLast4 ? (
          <p className="text-xs text-muted-foreground">
            Current API key: <span className="font-mono text-foreground">****{apiKeyLast4}</span>
          </p>
        ) : null}
      </div>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
        <li>
          In Dropbox Sign, create an API app from the{" "}
          <span className="font-medium text-foreground">API apps</span> section.
        </li>
        <li>
          Set that app&apos;s <span className="font-medium text-foreground">Event callback</span> to{" "}
          <span className="break-all font-mono text-xs text-foreground">
            {callbackUrl}
          </span>
          .
        </li>
        <li>
          Copy your account <span className="font-medium text-foreground">API key</span> and save it below.
        </li>
        <li>
          In non-production deployments, OpenCLA sends Dropbox Sign requests in test mode automatically.
        </li>
      </ol>

      <label className="mt-4 block space-y-1 text-sm">
        <span className="font-medium text-foreground">API key</span>
        <input
          autoComplete="off"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          name="apiKey"
          placeholder={apiKeyLast4 ? `****${apiKeyLast4}` : "Dropbox Sign API key"}
          required={!apiKeyLast4}
          type="password"
        />
      </label>

      <div className="mt-4 flex justify-end">
        <SubmitButton disabled={pending} pendingLabel="Saving…" size="sm">
          Save credentials
        </SubmitButton>
      </div>
    </form>
  );
}

function stringFormValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function applyRepositoryPatch(
  result: RepositoryActionResult,
  setTemplatesResponse: Dispatch<SetStateAction<TemplatesResponse>>
): void {
  if (!result.patch) {
    return;
  }

  setTemplatesResponse((current) => ({
    ...current,
    ...result.patch
  }));
}

/** cmdk lowercases `value`; suffix encodes the stable action key for onSelect */
function claPolicyCmdValue(searchBlob: string, actionKey: string): string {
  return `${searchBlob.toLowerCase()}|||${actionKey}`;
}

function parseClaPolicyCmdValue(value: string): string {
  const idx = value.lastIndexOf("|||");
  return idx >= 0 ? value.slice(idx + 3) : value;
}

function ClaPolicySearchableSelect({
  isRepositoryFilePolicy,
  managedVersionId,
  pending,
  settings,
  defaultTemplates,
  globalCustomTemplates,
  repoCustomTemplates,
  onSelectTemplate
}: {
  isRepositoryFilePolicy: boolean;
  managedVersionId: string | null;
  pending: boolean;
  settings: TemplatesResponse["settings"];
  defaultTemplates: TemplateSummary[];
  globalCustomTemplates: TemplateSummary[];
  repoCustomTemplates: TemplateSummary[];
  onSelectTemplate: (templateVersionId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const triggerLabel = useMemo(() => {
    if (isRepositoryFilePolicy) return "Repository CLA.md";
    if (settings.mode === "managed") {
      const name = settings.selectedTemplateName?.trim();
      return name && name.length > 0 ? name : "Managed template";
    }
    return "Select CLA policy…";
  }, [isRepositoryFilePolicy, settings.mode, settings.selectedTemplateName]);

  function applyActionKey(key: string) {
    if (key === "repo") {
      onSelectTemplate(null);
    } else if (key.startsWith("v:")) {
      onSelectTemplate(key.slice(2));
    }
    setOpen(false);
  }

  function isVersionPolicyActive(versionId: string): boolean {
    return !isRepositoryFilePolicy && !!managedVersionId && managedVersionId === versionId;
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="h-auto min-h-9 w-fit max-w-[min(100%,24rem)] justify-between gap-2 py-2 pr-3 pl-3 font-normal"
          disabled={pending}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate text-left text-sm leading-snug">{triggerLabel}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(24rem,75vh)] w-[max(var(--radix-popover-trigger-width),19rem)] max-w-[min(calc(100vw-2rem),24rem)] overflow-hidden p-0"
      >
        <Command>
          <CommandInput placeholder="Search CLA policies…" />
          <CommandList>
            <CommandEmpty>No matching policy.</CommandEmpty>

            <CommandGroup heading="Repository">
              <CommandItem
                data-checked={isRepositoryFilePolicy}
                onSelect={(v) => applyActionKey(parseClaPolicyCmdValue(v))}
                value={claPolicyCmdValue("repository cla md file default branch", "repo")}
              >
                Repository CLA.md
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Built-in defaults">
              {defaultTemplates.length > 0 ? (
                defaultTemplates.map((template) => {
                  const versionId = template.latestVersion?.templateVersionId;
                  if (!versionId) {
                    return (
                      <CommandItem disabled key={template.templateId} value={`no-version-default-${template.templateId}`}>
                        {template.name} (no version)
                      </CommandItem>
                    );
                  }

                  return (
                    <CommandItem
                      key={template.templateId}
                      data-checked={isVersionPolicyActive(versionId)}
                      onSelect={(v) => applyActionKey(parseClaPolicyCmdValue(v))}
                      value={claPolicyCmdValue(
                        `${template.name} built-in default bundled ${template.description ?? ""}`,
                        `v:${versionId}`
                      )}
                    >
                      <span className="min-w-0">{template.name}</span>
                    </CommandItem>
                  );
                })
              ) : (
                <CommandItem disabled value="built-in-default-unavailable-not-configured">
                  Built-in defaults not available
                </CommandItem>
              )}
            </CommandGroup>

            {globalCustomTemplates.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Your templates">
                  {globalCustomTemplates.map((template) => {
                    const versionId = template.latestVersion?.templateVersionId;
                    if (!versionId) {
                      return (
                        <CommandItem disabled key={template.templateId} value={`no-version-${template.templateId}`}>
                          {template.name} (no version)
                        </CommandItem>
                      );
                    }
                    return (
                      <CommandItem
                        key={template.templateId}
                        data-checked={isVersionPolicyActive(versionId)}
                        onSelect={(v) => applyActionKey(parseClaPolicyCmdValue(v))}
                        value={claPolicyCmdValue(
                          `${template.name} workspace global upload ${template.description ?? ""}`,
                          `v:${versionId}`
                        )}
                      >
                        <span className="min-w-0">{template.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            ) : null}

            {repoCustomTemplates.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Scoped to this repository">
                  {repoCustomTemplates.map((template) => {
                    const versionId = template.latestVersion?.templateVersionId;
                    if (!versionId) {
                      return (
                        <CommandItem disabled key={template.templateId} value={`no-version-repo-${template.templateId}`}>
                          {template.name} (no version)
                        </CommandItem>
                      );
                    }
                    return (
                      <CommandItem
                        key={template.templateId}
                        data-checked={isVersionPolicyActive(versionId)}
                        onSelect={(v) => applyActionKey(parseClaPolicyCmdValue(v))}
                        value={claPolicyCmdValue(
                          `${template.name} this repository scoped upload ${template.description ?? ""}`,
                          `v:${versionId}`
                        )}
                      >
                        <span className="min-w-0">{template.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function splitTemplates(templates: TemplateSummary[], repositoryId: string) {
  const defaultTemplates = templates.filter(
    (template) => template.source === "default" && template.repositoryId === null
  );

  const customRest = templates.filter((template) => template.source !== "default");
  const globalCustomTemplates = customRest.filter((template) => template.repositoryId === null);
  const repoCustomTemplates = customRest.filter((template) => template.repositoryId === repositoryId);

  return { defaultTemplates, globalCustomTemplates, repoCustomTemplates };
}

function groupSignatures(signatures: SignatureRecord[]): {
  key: string;
  documentSource: ClaDocumentSource;
  documentLabel: string;
  claVersionHash: string;
  signatures: SignatureRecord[];
}[] {
  const buckets = new Map<string, SignatureRecord[]>();
  for (const sig of signatures) {
    const key = `${sig.documentSource}\x1f${sig.documentLabel}\x1f${sig.claVersionHash}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(sig);
    buckets.set(key, bucket);
  }

  const grouped = [...buckets.entries()].map(([key, signaturesInGroup]) => {
    const first = signaturesInGroup[0];
    return {
      key,
      documentSource: first!.documentSource,
      documentLabel: first!.documentLabel,
      claVersionHash: first!.claVersionHash,
      signatures: signaturesInGroup.sort(
        (a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime()
      )
    };
  });

  grouped.sort((a, b) => {
    const orderDelta = documentSourceRank(a.documentSource) - documentSourceRank(b.documentSource);
    if (orderDelta !== 0) return orderDelta;
    return `${a.documentLabel}`.localeCompare(`${b.documentLabel}`);
  });

  return grouped;
}

function documentSourceRank(source: ClaDocumentSource): number {
  if (source === "repository") return 0;
  if (source === "managed_template") return 1;
  return 2;
}

function documentSourceBadge(source: ClaDocumentSource): string {
  if (source === "repository") return "Repository";
  if (source === "default_template") return "Platform fallback";
  return "Managed template";
}
