import { db } from "@/lib/external/db";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const docs = await db.document.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold">Documents</h1>
      <p className="text-sm text-gray-500">
        PDF / DOCX / TXT / MD 업로드 시 파싱 → 임베딩 파이프라인이 백그라운드로 실행됩니다.
      </p>
      <UploadForm />
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Filename</th>
            <th className="py-2">Status</th>
            <th className="py-2">Pages</th>
            <th className="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-gray-400">
                no documents yet
              </td>
            </tr>
          ) : (
            docs.map((d) => (
              <tr key={d.id} className="border-b">
                <td className="py-2 font-mono">{d.originalName}</td>
                <td className="py-2">{d.status}</td>
                <td className="py-2">{d.pageCount ?? "—"}</td>
                <td className="py-2 text-gray-500">
                  {d.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
