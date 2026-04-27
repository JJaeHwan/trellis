"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("파일을 선택하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        setError(`업로드 실패 (${res.status}): ${text}`);
        return;
      }
      formRef.current.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-wrap items-center gap-3 rounded border border-dashed border-gray-300 p-4"
    >
      <input
        type="file"
        name="file"
        accept=".pdf,.docx,.txt,.md"
        required
        disabled={busy}
        className="text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "업로드 중..." : "업로드"}
      </button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}
