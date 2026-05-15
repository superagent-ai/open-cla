import type { AdminUser } from "@superagent-cla/shared";
import { redirect } from "next/navigation";

import { TemplateNewDashboard } from "@/components/template-new-dashboard";
import { ApiError, adminApiFetch, browserApiBaseUrl } from "@/lib/api";

export default async function NewTemplatePage() {
  try {
    const user = await adminApiFetch<AdminUser>("/api/admin/me");

        return <TemplateNewDashboard apiBaseUrl={browserApiBaseUrl} user={user} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/");
    }

    throw error;
  }
}
