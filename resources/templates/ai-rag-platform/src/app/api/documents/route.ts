import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/external/db";
import { getEnv } from "@/lib/config/env";
import { processDocument } from "@/lib/service/document/pipeline";

export async function GET() {
  const docs = await db.document.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    documents: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      originalName: d.originalName,
      status: d.status,
      pageCount: d.pageCount,
      createdAt: d.createdAt,
    })),
  });
}

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "",
]);

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "missing 'file' field" },
      { status: 400 },
    );
  }

  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported content-type: ${file.type}` },
      { status: 415 },
    );
  }

  const env = getEnv();
  await mkdir(env.UPLOAD_DIR, { recursive: true });

  const ext = extname(file.name) || ".bin";
  const stored = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(env.UPLOAD_DIR, stored), buffer);

  const doc = await db.document.create({
    data: {
      filename: stored,
      originalName: file.name,
      contentType: file.type || null,
      fileSize: buffer.byteLength,
      status: "UPLOADED",
    },
  });

  // Fire-and-forget: pipeline persists FAILED status itself, swallow rejection.
  void processDocument(doc.id, buffer).catch(() => undefined);

  return NextResponse.json(
    { id: doc.id, status: doc.status },
    { status: 201 },
  );
}
