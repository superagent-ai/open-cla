import { marked, type Token, type Tokens } from "marked";

import { PDF_MARGIN, type PdfTextLine } from "./claPdf.js";

const INDENT_STEP = 16;

export function markdownToPdfLines(markdown: string): PdfTextLine[] {
  const tokens = marked.lexer(markdown.trim());
  const lines: PdfTextLine[] = [];
  walkBlockTokens(tokens, lines, 0);
  return trimTrailingBlankLines(lines);
}

function walkBlockTokens(tokens: Token[], lines: PdfTextLine[], depth: number): void {
  for (const token of tokens) {
    switch (token.type) {
      case "space":
        break;
      case "heading": {
        const heading = token as Tokens.Heading;
        appendParagraph(lines, flattenInline(heading.text), {
          size: headingSize(heading.depth),
          strong: true,
          depth
        });
        lines.push(blankLine(depth));
        break;
      }
      case "paragraph": {
        const paragraph = token as Tokens.Paragraph;
        appendParagraph(lines, paragraphText(paragraph), { size: 10, strong: false, depth });
        lines.push(blankLine(depth));
        break;
      }
      case "blockquote": {
        const blockquote = token as Tokens.Blockquote;
        walkBlockTokens(blockquote.tokens, lines, depth + 1);
        lines.push(blankLine(depth));
        break;
      }
      case "list": {
        appendList(lines, token as Tokens.List, depth);
        lines.push(blankLine(depth));
        break;
      }
      case "code": {
        const code = token as Tokens.Code;
        for (const codeLine of code.text.split("\n")) {
          lines.push({
            text: codeLine,
            size: 9,
            strong: false,
            x: xForDepth(depth + 1)
          });
        }
        lines.push(blankLine(depth));
        break;
      }
      case "hr":
        lines.push({ text: "—".repeat(48), size: 10, strong: false, x: xForDepth(depth) });
        lines.push(blankLine(depth));
        break;
      case "table": {
        appendTable(lines, token as Tokens.Table, depth);
        lines.push(blankLine(depth));
        break;
      }
      case "html": {
        const html = token as Tokens.HTML;
        appendParagraph(lines, stripHtml(html.raw), { size: 10, strong: false, depth });
        lines.push(blankLine(depth));
        break;
      }
      default:
        break;
    }
  }
}

function appendList(lines: PdfTextLine[], token: Tokens.List, depth: number): void {
  let index = 1;
  for (const item of token.items) {
    const prefix = token.ordered ? `${index}. ` : "• ";
    const body = listItemText(item);
    appendParagraph(lines, `${prefix}${body}`, {
      size: 10,
      strong: false,
      depth: depth + 1
    });

    const nested = item.tokens.filter(
      (nestedToken) => nestedToken.type !== "text" && nestedToken.type !== "paragraph"
    );
    if (nested.length > 0) {
      walkBlockTokens(nested, lines, depth + 2);
    }

    index += 1;
  }
}

function appendTable(lines: PdfTextLine[], token: Tokens.Table, depth: number): void {
  const header = token.header.map((cell) => flattenInline(cell.text)).join(" | ");
  if (header.trim()) {
    lines.push({ text: header, size: 10, strong: true, x: xForDepth(depth) });
  }

  for (const row of token.rows) {
    const rowText = row.map((cell) => flattenInline(cell.text)).join(" | ");
    if (rowText.trim()) {
      lines.push({ text: rowText, size: 10, strong: false, x: xForDepth(depth) });
    }
  }
}

function appendParagraph(
  lines: PdfTextLine[],
  text: string,
  options: { size: number; strong: boolean; depth: number }
): void {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return;
  }

  lines.push({
    text: normalized,
    size: options.size,
    strong: options.strong,
    x: xForDepth(options.depth)
  });
}

function paragraphText(token: Tokens.Paragraph): string {
  if (token.tokens?.length) {
    return flattenTokens(token.tokens);
  }
  return flattenInline(token.text);
}

function listItemText(item: Tokens.ListItem): string {
  if (item.tokens?.length) {
    const paragraphTokens = item.tokens.filter(
      (token): token is Tokens.Paragraph => token.type === "paragraph"
    );
    if (paragraphTokens.length > 0) {
      return paragraphTokens.map((token) => paragraphText(token)).join(" ");
    }
    return flattenTokens(item.tokens);
  }
  return flattenInline(item.text);
}

function flattenTokens(tokens: Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case "text":
          return flattenInline(token.text);
        case "strong":
        case "em":
        case "del":
          return token.tokens ? flattenTokens(token.tokens) : "";
        case "codespan":
          return token.text;
        case "link":
          return token.text === token.href ? token.text : `${token.text} (${token.href})`;
        case "br":
          return " ";
        case "escape":
          return token.text;
        default:
          return "text" in token && typeof token.text === "string" ? flattenInline(token.text) : "";
      }
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) =>
      label === href ? label : `${label} (${href})`
    )
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function headingSize(depth: number): number {
  if (depth <= 1) return 16;
  if (depth === 2) return 13;
  if (depth === 3) return 12;
  return 11;
}

function xForDepth(depth: number): number {
  return PDF_MARGIN + depth * INDENT_STEP;
}

function blankLine(depth: number): PdfTextLine {
  return { text: "", size: 10, strong: false, x: xForDepth(depth) };
}

function trimTrailingBlankLines(lines: PdfTextLine[]): PdfTextLine[] {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1]!.text.trim() === "") {
    trimmed.pop();
  }
  return trimmed;
}
