import type {
  AdminInstallation,
  AdminUser,
  SignaturesResponse,
  TemplatesResponse
} from "@superagent-cla/shared";
import { ArrowRight } from "lucide-react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { Button } from "@/components/ui/button";
import { ApiError, adminApiFetch, browserApiBaseUrl, webBaseUrl } from "@/lib/api";

type HomePageProps = {
  searchParams: Promise<{ repositoryId?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { repositoryId } = await searchParams;

  try {
    const user = await adminApiFetch<AdminUser>("/api/admin/me");

    if (repositoryId) {
      try {
        const [templatesResponse, signaturesResponse] = await Promise.all([
          adminApiFetch<TemplatesResponse>(`/api/admin/repositories/${repositoryId}/templates`),
          adminApiFetch<SignaturesResponse>(`/api/admin/repositories/${repositoryId}/signatures`)
        ]);

        return (
          <AdminDashboard
            apiBaseUrl={browserApiBaseUrl}
            user={user}
            installations={[]}
            selectedRepositoryId={repositoryId}
            templatesResponse={templatesResponse}
            signaturesResponse={signaturesResponse}
          />
        );
      } catch (error) {
        if (error instanceof ApiError && [400, 403, 404].includes(error.status)) {
          // Fall through to the cards list when the repository isn't accessible.
        } else {
          throw error;
        }
      }
    }

    const installationsResponse = await adminApiFetch<{
      installations: AdminInstallation[];
    }>("/api/admin/installations");

    return (
      <AdminDashboard
        apiBaseUrl={browserApiBaseUrl}
        user={user}
        installations={installationsResponse.installations}
        selectedRepositoryId={null}
        templatesResponse={null}
        signaturesResponse={null}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return <LoggedOutLanding />;
    }

    throw error;
  }
}

function LoggedOutLanding() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <section className="flex w-full max-w-sm flex-col items-center text-center">
        <img
          src="/images/logo.webp"
          alt="OpenCLA"
          className="mb-8 h-14 w-auto object-contain"
        />
        <h1 className="text-2xl font-semibold tracking-tight">OpenCLA</h1>

        <form action={`${browserApiBaseUrl}/auth/github/start`} className="mt-8 w-full max-w-xs">
          <input name="returnTo" type="hidden" value={new URL("/", webBaseUrl).toString()} />
          <Button className="w-full" type="submit">
            Continue with GitHub
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-6 max-w-md text-center text-xs leading-5 text-muted-foreground">
          By creating an account you agree to our terms of service and privacy policy.{" "}
          <a
            className="whitespace-nowrap underline underline-offset-4 hover:text-foreground"
            href="https://www.superagent.sh/legal"
          >
            Read more here
          </a>
          .
        </p>
      </section>
    </main>
  );
}
