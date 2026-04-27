import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { DocumentProcessingError } from "@/lib/common/errors";

export interface ParsedDocument {
  readonly text: string;
  readonly pageCount: number | null;
}

export async function parseFile(
  buffer: Buffer,
  contentType: string | null,
): Promise<ParsedDocument> {
  const ct = (contentType ?? "").toLowerCase();
  try {
    if (ct.includes("pdf")) {
      const out = await pdfParse(buffer);
      return { text: out.text, pageCount: out.numpages };
    }
    if (
      ct.includes("officedocument.wordprocessingml.document") ||
      ct.includes("msword")
    ) {
      const out = await mammoth.extractRawText({ buffer });
      return { text: out.value, pageCount: null };
    }
    if (ct.includes("text/") || ct === "") {
      return { text: buffer.toString("utf-8"), pageCount: null };
    }
    throw new DocumentProcessingError("parse", `unsupported content-type: ${ct}`);
  } catch (e) {
    if (e instanceof DocumentProcessingError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new DocumentProcessingError("parse", msg);
  }
}
