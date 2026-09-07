"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function PresentationUploadForm({ presentationId, replacing, useBlob }: { presentationId: string; replacing: boolean; useBlob: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (!useBlob) return;
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return setError("Choose a presentation file.");
    setBusy(true); setError(""); setProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
      const blob = await upload(`presentations/${presentationId}/${Date.now()}-${safeName}`, file, {
        access: "private",
        handleUploadUrl: "/api/presentations/blob-upload",
        clientPayload: JSON.stringify({ presentationId }),
        multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      const response = await fetch("/api/presentations/blob-finalize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId, originalName: file.name, url: blob.url, pathname: blob.pathname }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Upload could not be saved.");
      router.push("/dashboard?notice=presentation-uploaded");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed. Please try again.");
      setBusy(false);
    }
  }

  return <form action="/api/presentations/upload" method="post" encType="multipart/form-data" onSubmit={submit}>
    <input type="hidden" name="presentationId" value={presentationId}/>
    <label>{replacing ? "Replace presentation file" : "Presentation file"}<input type="file" name="file" accept=".ppt,.pptx,.pdf" required disabled={busy}/></label>
    {busy && <small className="upload-progress" role="status">Uploading… {progress}%</small>}
    {error && <small className="upload-error" role="alert">{error}</small>}
    <button className="primary-button" disabled={busy}>{busy ? "Uploading…" : replacing ? "Upload new version" : "Upload presentation"}</button>
  </form>;
}
