import { cookies } from "next/headers";

import { serverApiBaseUrl } from "@/lib/api";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { templateId } = await context.params;
  const cookieStore = await cookies();

  const upstream = await fetch(`${serverApiBaseUrl}/api/admin/templates/${templateId}/pdf`, {
    headers: {
      cookie: cookieStore.toString()
    },
    cache: "no-store"
  });

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/pdf",
      "cache-control": upstream.headers.get("cache-control") ?? "private, max-age=3600"
    }
  });
}
