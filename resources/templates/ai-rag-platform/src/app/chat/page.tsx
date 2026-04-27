"use client";

import { useState } from "react";

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setAnswer("");
    try {
      const res = await fetch("/api/chat/sessions/sandbox/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, documentIds: [] }),
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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold">Chat</h1>
      <p className="text-sm text-gray-500">
        SSE 스트리밍 데모. 실제 인덱싱된 문서를 선택하는 UI 는 P2 (Session B).
      </p>
      <form onSubmit={ask} className="flex gap-2">
        <input
          type="text"
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="ask a question"
          className="flex-1 rounded border px-3 py-2"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
      <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm dark:bg-gray-900">
        {answer || "(answer streams here)"}
      </pre>
    </main>
  );
}
