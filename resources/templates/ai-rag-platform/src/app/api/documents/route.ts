import { NextResponse } from "next/server";
import { db } from "@/lib/external/db";

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

// POST upload handler is wired in P1 (Session B). It will:
//   1. parse multipart/form-data
//   2. write file to uploads/
//   3. create Document row (status=UPLOADED)
//   4. fire-and-forget processDocument() from pipeline
export async function POST() {
  return NextResponse.json(
    { error: "not implemented yet — see docs/plans/01-upload-pipeline.md" },
    { status: 501 },
  );
}
