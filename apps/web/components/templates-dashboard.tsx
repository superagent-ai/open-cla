"use client";

import type { AdminUser, GlobalTemplateSummary } from "@superagent-cla/shared";
import { ditherAvatarDataUri } from "dither-avatar";
import { FileText, PenLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TemplatesDashboardProps = {
  apiBaseUrl: string;
  user: AdminUser;
  templates: GlobalTemplateSummary[];
};

export function TemplatesDashboard({ apiBaseUrl, user, templates }: TemplatesDashboardProps) {
  const router = useRouter();

  const { defaultTemplates, myTemplates } = useMemo(() => {
    const defaults: GlobalTemplateSummary[] = [];
    const mine: GlobalTemplateSummary[] = [];
    for (const template of templates) {
      if (template.source === "default") {
        defaults.push(template);
      } else {
        mine.push(template);
      }
    }
    return { defaultTemplates: defaults, myTemplates: mine };
  }, [templates]);

  return (
    <DashboardShell apiBaseUrl={apiBaseUrl} user={user}>
      <Tabs className="gap-6" defaultValue="mine">
        <div className="flex items-center justify-between gap-4 border-b border-border">
          <TabsList variant="line" className="-mb-px">
            <TabsTrigger className="text-base" value="mine">
              Your templates
            </TabsTrigger>
            <TabsTrigger className="text-base" value="default">
              Default
            </TabsTrigger>
          </TabsList>
          <Button
            className="-mb-px shrink-0"
            onClick={() => router.push("/templates/new")}
            size="sm"
            type="button"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        <TabsContent value="mine">
          {myTemplates.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>No Templates Yet</EmptyTitle>
                <EmptyDescription>
                  Create a reusable CLA template that repositories can select from their policy settings.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center">
                <Button onClick={() => router.push("/templates/new")} type="button">
                  <Plus className="h-4 w-4" />
                  Add New
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {myTemplates.map((template) => (
                <TemplateCard key={template.templateId} template={template} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="default">
          {defaultTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No default templates available.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {defaultTemplates.map((template) => (
                <TemplateCard key={template.templateId} template={template} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function TemplateCard({ template }: { template: GlobalTemplateSummary }) {
  const isDefault = template.source === "default";
  const isDropbox = template.source === "dropbox_sign";
  const seed = `${template.templateId}-${template.name}`;
  const subtitle = template.latestVersion
    ? `${template.latestVersion.versionHash.slice(0, 12)}${
        template.createdByLogin && !isDefault ? ` · @${template.createdByLogin}` : ""
      }`
    : "No version yet";

  const content = (
    <>
      <div
        className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-muted"
        style={{
          backgroundImage: `url("${ditherAvatarDataUri(seed)}")`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/5">
          {isDropbox ? <PenLine className="h-3 w-3" /> : null}
          {isDefault ? "Default" : isDropbox ? "Dropbox Sign" : "Custom"}
        </span>
      </div>
      <div className="flex items-start gap-3 px-1">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold uppercase">
          {template.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </>
  );

  if (template.isMine || isDefault) {
    return (
      <a
        href={`/templates/${template.templateId}`}
        className="group flex cursor-pointer flex-col gap-3 rounded-2xl text-left transition-transform hover:-translate-y-0.5"
      >
        {content}
      </a>
    );
  }

  return <div className="flex flex-col gap-3 rounded-2xl text-left">{content}</div>;
}
