"use client";

import { useActionState } from "react";
import { createExamAction } from "@/app/admin/actions";

type Sentence = { id: string; korean: string; primaryAnswer: string };

export function ExamForm({ sentences }: { sentences: Sentence[] }) {
  const [state, action, pending] = useActionState(createExamAction, {});
  return <form action={action} className="admin-form"><div className="form-row three"><label>시험 이름<input name="name" defaultValue="Weekly English Test" required /></label><label>문제 수<input name="questionCount" type="number" min="1" max="100" defaultValue="5" /></label><label>문항 제한시간<input name="timeLimitSec" type="number" min="5" max="300" defaultValue="30" /></label></div><label>합격 기준<input name="passScore" type="number" min="0" max="5" step="0.1" defaultValue="4.5" /></label><fieldset className="exam-picker"><legend>시험 문장 선택</legend>{sentences.map((sentence) => <label key={sentence.id}><input type="checkbox" name="sentenceIds" value={sentence.id} /><span><strong>{sentence.korean}</strong><small>{sentence.primaryAnswer}</small></span></label>)}</fieldset>{state.error && <p className="form-error">{state.error}</p>}{state.ok && <p className="form-success">{state.ok}</p>}<button className="primary-button" disabled={pending || sentences.length === 0}>{pending ? "활성화 중…" : "시험 세트 활성화"}</button></form>;
}
