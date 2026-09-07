"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type PresentationHistoryRow = { id: string; date: string; weekday: string; presenter: string; title: string; submittedAt: string | null; fileName: string | null; ratingCount: number; evaluatorCount: number; average: number };

export function PresentationHistory({ rows }: { rows: PresentationHistoryRow[] }) {
  const [query, setQuery] = useState(""); const [month, setMonth] = useState("");
  const filtered = useMemo(() => rows.filter((row) => (!month || row.date.startsWith(month)) && (!query || `${row.presenter} ${row.title}`.toLowerCase().includes(query.toLowerCase()))), [rows, month, query]);
  const overall = filtered.length ? filtered.reduce((sum, row) => sum + row.average, 0) / filtered.length : 0;
  return <><div className="history-summary"><div><span>Presentations</span><strong>{filtered.length}</strong></div><div><span>Overall average</span><strong>{overall.toFixed(2)}</strong></div><div><span>Files submitted</span><strong>{filtered.filter((row) => row.fileName).length}</strong></div></div><div className="history-filters"><label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Presenter or title" /></label><label>Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div><div className="presentation-history"><div className="history-row history-head"><span>Date</span><span>Presentation</span><span>File</span><span>Ratings</span><span>Average</span></div>{filtered.map((row) => <article className="history-row" key={row.id}><span><strong>{row.date}</strong><small>{row.weekday}</small></span><span><strong>{row.title}</strong><small>{row.presenter}</small></span><span>{row.fileName ? <Link href={`/api/presentations/${row.id}/download`}>{row.fileName}</Link> : <small className="missing-file">Missing</small>}</span><span><strong>{row.ratingCount}/{row.evaluatorCount}</strong><small>submitted</small></span><b>{row.average.toFixed(2)}</b></article>)}</div>{!filtered.length && <p className="muted history-empty">No matching presentation history.</p>}</>;
}
