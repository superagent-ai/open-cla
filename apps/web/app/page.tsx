import type {
  AdminInstallation,
  AdminUser,
  SignaturesResponse,
  TemplatesResponse
} from "@superagent-cla/shared";
import { AdminDashboard } from "@/components/admin-dashboard";
import { Button } from "@/components/ui/button";
import { ApiError, adminApiFetch, apiBaseUrl, githubLoginUrl } from "@/lib/api";

type HomePageProps = {
  searchParams: Promise<{ repositoryId?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { repositoryId } = await searchParams;

  try {
    const [user, installationsResponse] = await Promise.all([
      adminApiFetch<AdminUser>("/api/admin/me"),
      adminApiFetch<{ installations: AdminInstallation[] }>("/api/admin/installations")
    ]);

    const repositories = installationsResponse.installations.flatMap(
      (installation) => installation.repositories
    );
    const selectedRepositoryId =
      repositoryId && repositories.some((repository) => repository.repositoryId === repositoryId)
        ? repositoryId
        : (repositories[0]?.repositoryId ?? null);

    const [templatesResponse, signaturesResponse] = selectedRepositoryId
      ? await Promise.all([
          adminApiFetch<TemplatesResponse>(
            `/api/admin/repositories/${selectedRepositoryId}/templates`
          ),
          adminApiFetch<SignaturesResponse>(
            `/api/admin/repositories/${selectedRepositoryId}/signatures`
          )
        ])
      : [null, null];

    return (
      <AdminDashboard
        apiBaseUrl={apiBaseUrl}
        user={user}
        installations={installationsResponse.installations}
        selectedRepositoryId={selectedRepositoryId}
        templatesResponse={templatesResponse}
        signaturesResponse={signaturesResponse}
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
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12 text-slate-950">
      <section className="flex w-full max-w-md flex-col items-center text-center">
        <img
          src="/images/logo.webp"
          alt="OpenCLA"
          className="mb-10 h-16 w-auto object-contain"
        />
        <h1 className="text-3xl font-semibold tracking-tight">OpenCLA</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Manage CLA templates, signatures, and GitHub checks for your repositories.
        </p>

        <div className="mt-10 w-full">
          <Button
            asChild
            className="h-11 w-full rounded-md bg-slate-950 text-base font-medium text-white hover:bg-slate-800"
          >
            <a href={githubLoginUrl("/")}>Continue with GitHub</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
