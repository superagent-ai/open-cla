import { PDFDocument, StandardFonts } from "pdf-lib";

const SIGNATURE_TEXT_TAG = "[sig|req|signer1|Signature|opencla_signature]";

export async function appendClaSignaturePage(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const document = await PDFDocument.load(pdfBytes);
  const page = document.addPage([612, 792]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  page.drawText("Signature", {
    x: 54,
    y: 720,
    size: 12,
    font: bold
  });
  page.drawText(SIGNATURE_TEXT_TAG, {
    x: 54,
    y: 700,
    size: 10,
    font
  });

  return document.save();
}
