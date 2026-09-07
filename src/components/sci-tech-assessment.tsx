"use client";

import { useActionState, useEffect, useRef } from "react";
import type { SciTechRatingState } from "@/app/dashboard/actions";

export function SciTechAssessment({ presentation, action }: { presentation: { id: string; presenterName: string; canRate: boolean; reason?: string }; action: (state: SciTechRatingState, data: FormData) => Promise<SciTechRatingState> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, {});
  useEffect(() => { if (state.ok) dialog.current?.close(); }, [state.ok]);
  return <><button type="button" className="sci-tech-button" onClick={() => dialog.current?.showModal()}>Sci-Tech Assessment <span>＋</span></button><dialog ref={dialog} className="assessment-dialog"><form action={formAction}><input type="hidden" name="presentationId" value={presentation.id} /><header><div><small>SCI-TECH ASSESSMENT</small><h3>Enter a score</h3></div><button type="button" className="dialog-close" onClick={() => dialog.current?.close()} aria-label="Close">×</button></header><p>Rate <strong>{presentation.presenterName}</strong>&apos;s presentation from 0 to 5.</p>{presentation.canRate ? <label>Score<input name="score" type="number" min="0" max="5" step="0.1" placeholder="0.0 – 5.0" required autoFocus /></label> : <p className="dialog-notice">{presentation.reason}</p>}{state.error && <p className="form-error">{state.error}</p>}<footer><button type="button" className="dialog-cancel" onClick={() => dialog.current?.close()}>Cancel</button><button className="dialog-confirm" disabled={!presentation.canRate || pending}>{pending ? "Submitting…" : "Confirm"}</button></footer></form></dialog></>;
}
