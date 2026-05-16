import type { AdminUser, TemplateDetailResponse } from "@superagent-cla/shared";
import { notFound, redirect } from "next/navigation";

import { TemplateViewDashboard } from "@/components/template-view-dashboard";
import { ApiError, adminApiFetch, browserApiBaseUrl } from "@/lib/api";

type TemplatePageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function TemplatePage({ params }: TemplatePageProps) {
  const { templateId } = await params;

  try {
    const [user, detail] = await Promise.all([
      adminApiFetch<AdminUser>("/api/admin/me"),
      adminApiFetch<TemplateDetailResponse>(`/api/admin/templates/${templateId}`)
    ]);

    return (
      <TemplateViewDashboard
        apiBaseUrl={browserApiBaseUrl}
        user={user}
        template={detail.template}
        body={detail.body}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        redirect("/");
      }
      if (error.status === 403 || error.status === 404) {
        notFound();
      }
    }

    throw error;
  }
}
