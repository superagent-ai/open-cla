import { proxySigningSubmission } from "@/lib/signing-submit";

export async function POST(request: Request): Promise<Response> {
  return proxySigningSubmission(request, "personal");
}
