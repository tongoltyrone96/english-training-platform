"use client";

import { useActionState } from "react";
import { createSentenceAction } from "@/app/admin/actions";

export function SentenceForm() {
  const [state, action, pending] = useActionState(createSentenceAction, {});
  return <form action={action} className="admin-form">
    <div className="form-row"><label>한국어 문장<textarea name="korean" required maxLength={300} /></label><label>대표 영어 답안<textarea name="primaryAnswer" required maxLength={500} /></label></div>
    <div className="form-row"><label>추가 허용 답안 <small>한 줄에 하나</small><textarea name="alternateAnswers" /></label><label>핵심 keyword <small>쉼표로 구분</small><textarea name="keywords" /></label></div>
    <div className="form-row three"><label>분류<input name="category" defaultValue="general" required /></label><label>난이도<select name="difficulty" defaultValue="1">{[1,2,3,4,5].map((v) => <option key={v}>{v}</option>)}</select></label><label>사용처<select name="usage" defaultValue="TRAINING"><option value="TRAINING">Training</option><option value="TEST">Test</option><option value="BOTH">모두</option></select></label></div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.ok && <p className="form-success" role="status">{state.ok}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "저장 중…" : "문장 추가"}</button>
  </form>;
}
