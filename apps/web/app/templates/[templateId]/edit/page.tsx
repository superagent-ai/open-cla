import { redirect } from "next/navigation";

type EditTemplatePageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { templateId } = await params;
  redirect(`/templates/${templateId}`);
}
