import Link from "next/link";
import { PresentationUploadForm } from "@/components/presentation-upload-form";

type Presentation = { id: string; title: string; description: string | null; date: string; deadline: string | null; presenter: string; isMine: boolean; canUpload: boolean; file: { name: string; uploadedAt: string } | null };

export function PresentationCenter({ presentations }: { presentations: Presentation[] }) {
  const mine = presentations.find((item) => item.isMine);
  const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
  return <section className="presentation-center panel" id="presentation-hub"><header className="activity-heading"><div><p className="eyebrow">PRESENTATION HUB</p><h2>Upcoming presentations</h2></div><span className="status-badge">PPT · PPTX · PDF</span></header>
    {mine && <article className="my-presentation"><div><small>MY UPCOMING PRESENTATION</small><h3>{mine.title}</h3><p>{mine.date} · Upload by {mine.deadline ?? "the previous day"}</p>{mine.file && <div className="file-ready"><strong>✓ Submitted</strong><span>{mine.file.name}</span></div>}</div>{mine.canUpload ? <PresentationUploadForm presentationId={mine.id} replacing={Boolean(mine.file)} useBlob={useBlob}/> : !mine.file ? <div className="file-overdue"><strong>Upload overdue</strong><span>Contact an administrator.</span></div> : null}</article>}
    <div className="upcoming-list">{presentations.length ? presentations.map((item) => <article key={item.id}><time>{item.date}</time><div><strong>{item.title}</strong><span>{item.presenter}{item.description ? ` · ${item.description}` : ""}</span></div>{item.file ? <Link className="presentation-download" href={`/api/presentations/${item.id}/download`}>Download</Link> : <span className="file-pending">Awaiting file</span>}</article>) : <p className="muted">No presentations have been scheduled.</p>}</div>
  </section>;
}
