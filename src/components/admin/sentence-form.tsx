"use client";

import { useActionState } from "react";
import { createSentenceAction } from "@/app/admin/actions";

export function SentenceForm() {
  const [state, action, pending] = useActionState(createSentenceAction, {});
  return <form action={action} className="admin-form">
    <div className="form-row"><label>Korean sentence<textarea name="korean" required maxLength={300} /></label><label>Primary English answer<textarea name="primaryAnswer" required maxLength={500} /></label></div>
    <div className="form-row"><label>Additional accepted answers <small>One per line</small><textarea name="alternateAnswers" /></label><label>Key keywords <small>Comma separated</small><textarea name="keywords" /></label></div>
    <div className="form-row three"><label>Category<input name="category" defaultValue="general" required /></label><label>Difficulty<select name="difficulty" defaultValue="1">{[1,2,3,4,5].map((v) => <option key={v}>{v}</option>)}</select></label><label>Used in<select name="usage" defaultValue="TRAINING"><option value="TRAINING">Training</option><option value="TEST">Test</option><option value="BOTH">Both</option></select></label></div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.ok && <p className="form-success" role="status">{state.ok}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Add sentence"}</button>
  </form>;
}
