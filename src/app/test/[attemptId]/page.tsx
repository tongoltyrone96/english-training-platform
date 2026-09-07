import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { ExamRecorder } from "@/components/exam-recorder";

export default async function TestPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireUser(); const { attemptId } = await params;
  const attempt = await db.examAttempt.findFirst({ where: { id: attemptId, userId: user.id }, include: { exam: true, answers: { where: { evaluation: { isNot: null } }, orderBy: { position: "asc" }, include: { evaluation: true, examQuestion: { include: { sentence: true } } } } } });
  if (!attempt) notFound();
  if (attempt.status === "COMPLETED") return <main className="training-page"><section className="recorder-card exam-results"><p className="eyebrow">WEEKLY TEST COMPLETE</p><h1>{attempt.passed ? "합격했습니다" : "시험을 완료했습니다"}</h1><strong className="final-exam-score">{attempt.finalScore?.toString()} / 5.0</strong><p>{attempt.passed ? "이번 주의 노력이 좋은 결과로 이어졌어요." : "결과는 기록되었습니다. 다음 주 훈련에서 다시 성장해 보세요."}</p><div className="answer-review">{attempt.answers.map((answer) => <article key={answer.id}><span>{answer.position + 1}</span><div><strong>{answer.examQuestion.sentence.korean}</strong><p>{answer.evaluation?.transcript}</p><small>{answer.evaluation?.feedbackKo}</small></div><b>{answer.evaluation?.finalScore.toString()}</b></article>)}</div><Link href="/dashboard" className="primary-link">대시보드로 돌아가기</Link></section></main>;
  const position = attempt.answers.length; const questionId = attempt.questionOrder[position];
  const question = questionId ? await db.examQuestion.findFirst({ where: { id: questionId, examId: attempt.examId }, include: { sentence: true } }) : null;
  if (!question) notFound();
  return <main className="training-page"><header className="training-header"><span>English Test · {attempt.weekKey}</span><span>{position + 1} / {attempt.questionOrder.length}</span></header><ExamRecorder attemptId={attempt.id} questionId={question.id} korean={question.sentence.korean} position={position} timeLimitSec={attempt.exam.timeLimitSec} /></main>;
}
