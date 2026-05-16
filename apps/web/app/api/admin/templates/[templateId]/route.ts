import { cookies } from "next/headers";

import { serverApiBaseUrl } from "@/lib/api";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  return proxyTemplateRequest(request, context, "PUT");
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return proxyTemplateRequest(request, context, "DELETE");
}

async function proxyTemplateRequest(
  request: Request,
  context: RouteContext,
  method: "PUT" | "DELETE"
): Promise<Response> {
  const { templateId } = await context.params;
  const cookieStore = await cookies();
  const body = method === "PUT" ? await request.text() : undefined;

  const upstream = await fetch(`${serverApiBaseUrl}/api/admin/templates/${templateId}`, {
    method,
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
      cookie: cookieStore.toString()
    },
    body,
    cache: "no-store"
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json"
    }
  });
}
