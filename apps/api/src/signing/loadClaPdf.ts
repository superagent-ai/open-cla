import type { DbClient } from "../db/client.js";
import { fetchPdfFromUrl } from "./fetchPdf.js";

export async function loadClaPdfBytes(params: {
  pdfData: Buffer | null | undefined;
  pdfUrl: string | null | undefined;
}): Promise<Uint8Array> {
  if (params.pdfData && params.pdfData.length > 0) {
    return new Uint8Array(params.pdfData);
  }

  if (params.pdfUrl) {
    return fetchPdfFromUrl(params.pdfUrl);
  }

  throw new Error("CLA PDF is not available");
}

export async function loadClaDocumentPdfBytes(
  db: DbClient,
  claDocumentId: string
): Promise<Uint8Array> {
  const document = await db.query.claDocuments.findFirst({
    where: (table, { eq }) => eq(table.claDocumentId, claDocumentId)
  });
  if (!document) {
    throw new Error("CLA document not found");
  }

  return loadClaPdfBytes({
    pdfData: document.pdfData ?? null,
    pdfUrl: document.pdfUrl
  });
}
