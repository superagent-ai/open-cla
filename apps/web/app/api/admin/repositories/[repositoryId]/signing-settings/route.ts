import { cookies } from "next/headers";

import { serverApiBaseUrl } from "@/lib/api";

type RouteContext = {
  params: Promise<{
    repositoryId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { repositoryId } = await context.params;
  const cookieStore = await cookies();
  const body = await request.text();

  const upstream = await fetch(
    `${serverApiBaseUrl}/api/admin/repositories/${repositoryId}/signing-settings`,
    {
      method: "PUT",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        cookie: cookieStore.toString()
      },
      body,
      cache: "no-store"
    }
  );

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json"
    }
  });
}
