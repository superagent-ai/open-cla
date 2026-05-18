import { validatePdfBuffer } from "./validatePdf.js";

export async function fetchPdfFromUrl(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    throw new Error("Uploaded file must be a PDF");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  validatePdfBuffer(buffer);

  return new Uint8Array(buffer);
}
