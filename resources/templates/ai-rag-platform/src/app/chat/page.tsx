"use client";

import { useEffect, useState } from "react";

interface DocumentRow {
  id: string;
  filename: string;
  originalName: string;
  status: string;
  pageCount: number | null;
  createdAt: string;
}

export default function ChatPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/documents");
        const data = (await res.json()) as { documents: DocumentRow[] };
        setDocs(data.documents.filter((d) => d.status === "READY"));
      } catch {
        setError("문서 목록을 불러오지 못했습니다.");
      }
    })();
  }, []);

  function toggleDoc(id: string) {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
    setSessionId(null);
  }

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    if (selectedIds.length === 0) {
      setError("문서를 1개 이상 선택하세요.");
      return null;
    }
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: selectedIds }),
    });
    if (!res.ok) {
      setError(`세션 생성 실패 (${res.status})`);
      return null;
    }
    const { id } = (await res.json()) as { id: string };
    setSessionId(id);
    return id;
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setError(null);
    setBusy(true);
    setAnswer("");
    try {
      const id = await ensureSession();
      if (!id) return;
      const res = await fetch(`/api/chat/sessions/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.body) {
        setAnswer("(no stream)");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || selectedIds.length === 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold">Chat</h1>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">
          질의 대상 문서 ({selectedIds.length} 선택됨)
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-400">
            준비된 문서가 없습니다. 먼저 <a href="/documents" className="underline">/documents</a> 에서 업로드하세요.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {docs.map((d) => {
              const checked = selectedIds.includes(d.id);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => toggleDoc(d.id)}
                    className={`rounded border px-3 py-1 text-xs ${
                      checked
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300"
                    }`}
                  >
                    {d.originalName}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <form onSubmit={ask} className="flex gap-2">
        <input
          type="text"
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="ask a question"
          className="flex-1 rounded border px-3 py-2"
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm dark:bg-gray-900">
        {answer || "(answer streams here)"}
      </pre>
    </main>
  );
}
