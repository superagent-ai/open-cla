const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function validatePdfBuffer(buffer: Buffer): void {
  if (buffer.length === 0) {
    throw new Error("Uploaded PDF is empty");
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error("Uploaded PDF must be 20 MB or smaller");
  }
  if (!buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    throw new Error("Uploaded file is not a valid PDF");
  }
}

export function decodePdfBase64(pdfBase64: string): Buffer {
  const buffer = Buffer.from(pdfBase64, "base64");
  validatePdfBuffer(buffer);
  return buffer;
}
