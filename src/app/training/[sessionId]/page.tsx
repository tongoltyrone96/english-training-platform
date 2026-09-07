import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { TrainingRecorder } from "@/components/training-recorder";

type Snapshot = { questionCount: number; timeLimitSec: number; passScore: string; autoAdvance: boolean };

export default async function TrainingPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  const { sessionId } = await params;
  const session = await db.trainingSession.findFirst({ where: { id: sessionId, userId: user.id }, include: { items: { orderBy: { position: "asc" }, include: { sentence: true } } } });
  if (!session) notFound();
  if (session.status === "COMPLETED") redirect("/dashboard?notice=training-completed");
  const item = session.items[session.currentPosition];
  if (!item) redirect("/dashboard");
  const snapshot = session.settingsSnapshot as Snapshot;
  return <main className="training-page"><header className="training-header"><a href="/dashboard"><span>←</span> Dashboard</a><div className="training-progress-label"><small>SESSION PROGRESS</small><strong>{session.currentPosition + 1} <i>/</i> {session.items.length}</strong></div></header><TrainingRecorder key={item.id} sessionId={session.id} itemId={item.id} korean={item.sentence.korean} timeLimitSec={snapshot.timeLimitSec} passScore={snapshot.passScore} autoAdvance={snapshot.autoAdvance} /></main>;
}
