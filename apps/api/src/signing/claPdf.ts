export type PdfTextLine = {
  text: string;
  size: number;
  strong: boolean;
  x?: number;
};

export const PDF_PAGE_WIDTH = 612;
export const PDF_PAGE_HEIGHT = 792;
export const PDF_MARGIN = 54;
export const PDF_MAX_CHARS = 88;

export function layoutPdfLines(
  lines: PdfTextLine[],
  options: {
    pageWidth?: number;
    pageHeight?: number;
    margin?: number;
    maxChars?: number;
  } = {}
): Array<Array<PdfTextLine & { y: number }>> {
  const pageWidth = options.pageWidth ?? PDF_PAGE_WIDTH;
  const pageHeight = options.pageHeight ?? PDF_PAGE_HEIGHT;
  const margin = options.margin ?? PDF_MARGIN;
  const maxChars = options.maxChars ?? PDF_MAX_CHARS;

  const pages: Array<Array<PdfTextLine & { y: number }>> = [[]];
  let y = pageHeight - margin;

  for (const line of lines) {
    const size = line.size;
    const x = line.x ?? margin;
    const availableChars = Math.max(
      24,
      maxChars - Math.floor(Math.max(0, x - margin) / 6)
    );
    const chunks =
      line.text.trim().length === 0 ? [""] : wrapText(line.text, availableChars);

    for (const chunk of chunks) {
      if (y < margin + size + 40) {
        pages.push([]);
        y = pageHeight - margin;
      }
      pages[pages.length - 1]!.push({
        text: chunk,
        size,
        strong: line.strong,
        x,
        y
      });
      y -= size + 6;
    }
  }

  return pages;
}

export function buildPdf(params: {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  pages: Array<Array<PdfTextLine & { y: number }>>;
}): Uint8Array {
  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds: number[] = [];
  for (const lines of params.pages) {
    const content = lines
      .map((line) =>
        [
          "BT",
          `/${line.strong ? "F2" : "F1"} ${line.size} Tf`,
          `${line.x ?? params.margin} ${line.y} Td`,
          `(${escapePdfText(line.text)}) Tj`,
          "ET"
        ].join(" ")
      )
      .join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`
    );
    const pageId = addObject(
      [
        "<< /Type /Page",
        `/Parent ${pagesId} 0 R`,
        `/MediaBox [0 0 ${params.pageWidth} ${params.pageHeight}]`,
        "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>",
        `/Contents ${contentId} 0 R`,
        ">>"
      ].join(" ")
    );
    pageIds.push(pageId);
  }

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += [
    "trailer",
    `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");

  return new TextEncoder().encode(pdf);
}

function wrapText(text: string, maxChars: number): string[] {
  if (!text) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
