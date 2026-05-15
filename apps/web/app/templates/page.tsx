import type { AdminUser, GlobalTemplatesResponse } from "@superagent-cla/shared";
import { redirect } from "next/navigation";
import { TemplatesDashboard } from "@/components/templates-dashboard";
import { ApiError, adminApiFetch, browserApiBaseUrl } from "@/lib/api";

export default async function TemplatesPage() {
  try {
    const [user, templatesResponse] = await Promise.all([
      adminApiFetch<AdminUser>("/api/admin/me"),
      adminApiFetch<GlobalTemplatesResponse>("/api/admin/templates")
    ]);

    return (
      <TemplatesDashboard
        apiBaseUrl={browserApiBaseUrl}
        user={user}
        templates={templatesResponse.templates}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/");
    }

    throw error;
  }
}
