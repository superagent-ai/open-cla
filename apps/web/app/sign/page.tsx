import type { SigningPageResponse } from "@superagent-cla/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SigningPage } from "@/components/signing-page";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { githubLoginUrl, serverApiBaseUrl } from "@/lib/api";

type SignPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignPage({ searchParams }: SignPageProps) {
  const params = await searchParams;
  const signingQuery = signingSearchParams(params);
  const returnPath = `/sign${signingQuery.toString() ? `?${signingQuery.toString()}` : ""}`;
  const cookieStore = await cookies();

  const response = await fetch(`${serverApiBaseUrl}/api/sign?${signingQuery.toString()}`, {
    headers: {
      cookie: cookieStore.toString()
    },
    cache: "no-store"
  });

  if (response.status === 401) {
    redirect(githubLoginUrl(returnPath));
  }

  if (!response.ok) {
    return (
      <SigningLoadError
        status={response.status}
        message={await readErrorMessage(response)}
        returnPath={returnPath}
      />
    );
  }

  const signing = (await response.json()) as SigningPageResponse;
  return (
    <SigningPage
      signing={signing}
      signedKind={signedKind(params.signed)}
      error={singleValue(params.error)}
    />
  );
}

function SigningLoadError({
  status,
  message,
  returnPath
}: {
  status: number;
  message: string;
  returnPath: string;
}) {
  return (
    <>
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <a href="/" className="mb-4 inline-flex items-center">
              <img src="/images/logo.webp" alt="OpenCLA" className="h-10 w-auto object-contain" />
            </a>
            <CardTitle>Unable to load CLA</CardTitle>
            <CardDescription>
              {status === 404
                ? "The repository is not ready for CLA signing yet."
                : "The signing link could not be loaded."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {message}
            </div>
            {status === 401 ? (
              <Button asChild>
                <a href={githubLoginUrl(returnPath)}>Continue with GitHub</a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}

function signingSearchParams(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const query = new URLSearchParams();
  appendParam(query, "owner", params.owner);
  appendParam(query, "repo", params.repo);
  appendParam(query, "pull", params.pull);
  appendParam(query, "sha", params.sha);
  return query;
}

function appendParam(query: URLSearchParams, name: string, value: string | string[] | undefined): void {
  const single = singleValue(value);
  if (single) {
    query.set(name, single);
  }
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function signedKind(value: string | string[] | undefined): "personal" | "corporate" | null {
  const single = singleValue(value);
  return single === "personal" || single === "corporate" ? single : null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
