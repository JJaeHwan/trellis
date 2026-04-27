import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/external/db";

const createSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const session = await db.chatSession.create({
    data: { documentIds: parsed.data.documentIds },
  });
  return NextResponse.json({ id: session.id }, { status: 201 });
}
