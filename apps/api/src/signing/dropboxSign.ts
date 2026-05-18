import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppConfig } from "../config.js";
import type { SigningContext } from "@superagent-cla/shared";

import {
  buildPdf,
  layoutPdfLines,
  PDF_MARGIN,
  PDF_PAGE_HEIGHT,
  PDF_PAGE_WIDTH,
  type PdfTextLine
} from "./claPdf.js";
import { appendClaSignaturePage } from "./appendClaSignaturePage.js";
import { loadClaPdfBytes } from "./loadClaPdf.js";
import { markdownToPdfLines } from "./claMarkdownPdf.js";

const DROPBOX_SIGN_API_BASE = "https://api.hellosign.com/v3";
const SIGNATURE_TEXT_TAG = "[sig|req|signer1|Signature|opencla_signature]";

export type DropboxSigningRequestInput = {
  config: AppConfig;
  credentials: DropboxCredentials;
  title: string;
  body: string;
  contentFormat?: "markdown" | "pdf";
  pdfData?: Buffer | null;
  pdfUrl?: string | null;
  versionHash: string;
  signerName: string;
  signerEmail: string;
  repositoryFullName: string;
  kind: "personal" | "corporate";
  context: SigningContext;
  orgLogin?: string;
  /** Where Dropbox Sign sends the signer after they successfully sign. */
  signingRedirectUrl?: string;
};

export type DropboxCredentials = {
  apiKey: string;
};

export type DropboxSigningRequestResult = {
  providerRequestId: string;
  providerSignatureId: string;
};

export type DropboxEventCallback = {
  eventType: string;
  eventTime: string;
  signatureRequestId: string | null;
  payload: Record<string, unknown>;
};

type DropboxSignatureRequestResponse = {
  signature_request?: {
    signature_request_id?: string;
    signatures?: Array<{
      signature_id?: string;
    }>;
  };
};

export function dropboxUsesTestMode(config: AppConfig): boolean {
  const override = process.env.DROPBOX_SIGN_TEST_MODE;
  if (override === "true" || override === "1") {
    return true;
  }
  if (override === "false" || override === "0") {
    return false;
  }

  return config.NODE_ENV !== "production";
}

export async function createDropboxSigningRequest(
  input: DropboxSigningRequestInput
): Promise<DropboxSigningRequestResult> {
  const pdfBytes =
    input.contentFormat === "pdf" && (input.pdfData || input.pdfUrl)
      ? await appendClaSignaturePage(
          await loadClaPdfBytes({
            pdfData: input.pdfData,
            pdfUrl: input.pdfUrl
          })
        )
      : await renderClaPdf(input);
  const form = new FormData();
  form.set("title", input.title);
  form.set("subject", `Sign CLA for ${input.repositoryFullName}`);
  form.set(
    "message",
    `Please review and sign the ${input.kind} Contributor License Agreement for ${input.repositoryFullName}.`
  );
  form.set("test_mode", dropboxUsesTestMode(input.config) ? "1" : "0");
  if (input.signingRedirectUrl) {
    form.set("signing_redirect_url", input.signingRedirectUrl);
  }
  form.set("use_text_tags", "1");
  form.set("hide_text_tags", "1");
  // Text tags require signers as a JSON array, not string-indexed form fields.
  form.set(
    "signers",
    JSON.stringify([
      {
        name: input.signerName,
        email_address: input.signerEmail,
        order: 0
      }
    ])
  );
  form.append(
    "files[0]",
    new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" }),
    "opencla-agreement.pdf"
  );

  const createResponse = await dropboxFetch<DropboxSignatureRequestResponse>(
    input.credentials,
    "/signature_request/send",
    {
      method: "POST",
      body: form
    }
  );
  const providerRequestId = createResponse.signature_request?.signature_request_id;
  const providerSignatureId = createResponse.signature_request?.signatures?.[0]?.signature_id;
  if (!providerRequestId || !providerSignatureId) {
    throw new Error("Dropbox Sign did not return a signature request id");
  }

  return {
    providerRequestId,
    providerSignatureId
  };
}

export function verifyDropboxEventCallback(
  apiKey: string,
  body: unknown
): DropboxEventCallback | null {
  const payload = parseDropboxPayload(body);
  const event = payload.event;
  if (!isObject(event)) {
    return null;
  }

  const eventTime = stringField(event, "event_time");
  const eventType = stringField(event, "event_type");
  const eventHash = stringField(event, "event_hash");
  if (!eventTime || !eventType || !eventHash) {
    return null;
  }

  const expected = createHmac("sha256", apiKey)
    .update(`${eventTime}${eventType}`)
    .digest("hex");
  if (!constantTimeEqual(expected, eventHash)) {
    return null;
  }

  const signatureRequest = payload.signature_request;
  const signatureRequestId = isObject(signatureRequest)
    ? stringField(signatureRequest, "signature_request_id")
    : null;

  return {
    eventType,
    eventTime,
    signatureRequestId,
    payload
  };
}

export function getDropboxEventSignatureRequestId(body: unknown): string | null {
  const payload = parseDropboxPayload(body);
  const signatureRequest = payload.signature_request;
  return isObject(signatureRequest) ? stringField(signatureRequest, "signature_request_id") : null;
}

async function dropboxFetch<T>(
  credentials: DropboxCredentials,
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${DROPBOX_SIGN_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${Buffer.from(`${credentials.apiKey}:`).toString("base64")}`,
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Dropbox Sign request failed with ${response.status}${formatDropboxError(body)}`);
  }

  return response.json() as Promise<T>;
}

function formatDropboxError(body: string): string {
  if (!body) {
    return "";
  }

  try {
    const parsed = JSON.parse(body) as { error?: { error_msg?: unknown; error_name?: unknown } };
    const message = parsed.error?.error_msg;
    const name = parsed.error?.error_name;
    if (typeof message === "string") {
      return typeof name === "string" ? `: ${message} (${name})` : `: ${message}`;
    }
  } catch {
    // Fall through to the raw body.
  }

  return `: ${body}`;
}

async function renderClaPdf(input: DropboxSigningRequestInput): Promise<Uint8Array> {
  const lines: PdfTextLine[] = [
    { text: input.title, size: 16, strong: true },
    { text: `Repository: ${input.repositoryFullName}`, size: 10, strong: false },
    { text: `CLA version: ${input.versionHash}`, size: 10, strong: false },
    ...(input.orgLogin
      ? [{ text: `Organization: ${input.orgLogin}`, size: 10, strong: false }]
      : []),
    { text: "", size: 10, strong: false },
    ...markdownToPdfLines(input.body),
    { text: "", size: 10, strong: false },
    { text: "Signature", size: 12, strong: true },
    { text: SIGNATURE_TEXT_TAG, size: 10, strong: false }
  ];

  const pages = layoutPdfLines(lines);
  return buildPdf({
    pageWidth: PDF_PAGE_WIDTH,
    pageHeight: PDF_PAGE_HEIGHT,
    margin: PDF_MARGIN,
    pages
  });
}

function parseDropboxPayload(body: unknown): Record<string, unknown> {
  if (isObject(body) && typeof body.json === "string") {
    return JSON.parse(body.json) as Record<string, unknown>;
  }
  if (typeof body === "string") {
    return JSON.parse(body) as Record<string, unknown>;
  }
  if (isObject(body)) {
    return body;
  }
  throw new Error("Invalid Dropbox Sign callback payload");
}

function stringField(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
