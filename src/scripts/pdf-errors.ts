/** Map pdf.js load/render failures to flat i18n dictionary keys. */

export type PdfErrorKey =
  | "error_pdf_invalid"
  | "error_pdf_empty"
  | "error_pdf_password_required"
  | "error_pdf_password_incorrect"
  | "error_pdf_render_timeout"
  | "error_browser_unsupported"
  | "error_pdf_assets"
  | "redact_file_error";

export function isPdfFileBytes(data: Uint8Array): boolean {
  if (data.length < 5) return false;
  return data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46;
}

export function isPasswordPdfError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String(err.name) : "";
  const message = "message" in err ? String(err.message) : "";
  const code = "code" in err ? Number((err as { code?: number }).code) : NaN;
  return (
    name === "PasswordException" ||
    code === 1 ||
    /password/i.test(message)
  );
}

export function isIncorrectPasswordPdfError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String(err.name) : "";
  const message = "message" in err ? String(err.message) : "";
  const code = "code" in err ? Number((err as { code?: number }).code) : NaN;
  return name === "PasswordException" && code === 2
    ? true
    : /incorrect password|wrong password|password.*incorrect/i.test(message);
}

export function classifyPdfLoadError(err: unknown): PdfErrorKey {
  if (isIncorrectPasswordPdfError(err)) return "error_pdf_password_incorrect";
  if (isPasswordPdfError(err)) return "error_pdf_password_required";

  if (err instanceof Error && err.message) {
    const msg = err.message;
    if (msg.includes("PDF empty") || msg === "Empty file") return "error_pdf_empty";
    if (msg.includes("Invalid PDF")) return "error_pdf_invalid";
    if (msg.includes("PDF render timeout")) return "error_pdf_render_timeout";
    if (msg.includes("PDF render blank")) return "error_pdf_render_timeout";
    if (msg.includes("withResolvers")) return "error_browser_unsupported";
    if (msg.includes("Canvas")) return "error_pdf_render_timeout";
    if (/Invalid PDF|InvalidPDF|Missing PDF|MissingPDF|corrupt/i.test(msg)) {
      return "error_pdf_invalid";
    }
    if (/UnexpectedResponse|Failed to fetch|NetworkError|404|wasm|openjpeg|jbig2/i.test(msg)) {
      return "error_pdf_assets";
    }
  }

  if (err && typeof err === "object" && "name" in err) {
    const name = String(err.name);
    if (name === "InvalidPDFException" || name === "MissingPDFException") {
      return "error_pdf_invalid";
    }
    if (name === "UnexpectedResponseException" || name === "ResponseException") {
      return "error_pdf_assets";
    }
  }

  return "redact_file_error";
}
