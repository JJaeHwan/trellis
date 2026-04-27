import { db } from "@/lib/external/db";

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
        업로드는 P1 (Session B) 에서 폼 + multipart 핸들러로 활성화. 현재는 목록만.
      </p>
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
