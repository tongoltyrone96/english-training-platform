"use client";

import { useActionState } from "react";
import { clearDailyTrainingOverrideAction, saveDailyTrainingOverrideAction } from "@/app/admin/actions";

export type DailyTrainingRow = { id: string; name: string; email: string; assigned: number; passed: number; actualPassed: boolean; actualScore: number | null; adminPassed: boolean | null; adminScore: number | null };

function TrainingRow({ row, date }: { row: DailyTrainingRow; date: string }) {
  const [state, action, pending] = useActionState(saveDailyTrainingOverrideAction, {});
  const effectivePassed = row.adminPassed ?? row.actualPassed; const effectiveScore = row.adminScore ?? row.actualScore;
  return <article className="daily-training-row"><div className="daily-member"><strong>{row.name}</strong><small>{row.email}</small></div><div className="daily-auto"><span className={`daily-status ${effectivePassed ? "passed" : row.passed ? "progress" : "idle"}`}>{effectivePassed ? "Passed" : row.passed ? "In progress" : "Not started"}</span><small>{row.passed}/{row.assigned || 0} passed · Auto {row.actualScore === null ? "—" : row.actualScore.toFixed(2)}</small></div><form action={action}><input type="hidden" name="userId" value={row.id} /><input type="hidden" name="localDate" value={date} /><label><span>Final score</span><input name="score" type="number" min="0" max="5" step="0.01" defaultValue={effectiveScore ?? ""} required /></label><label className="daily-pass-check"><input name="passed" type="checkbox" defaultChecked={effectivePassed} /><span>Passed</span></label><button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save"}</button></form><form action={clearDailyTrainingOverrideAction}><input type="hidden" name="userId" value={row.id} /><input type="hidden" name="localDate" value={date} /><button className="ghost-button" disabled={row.adminPassed === null && row.adminScore === null}>Use automatic</button></form>{state.error && <p className="form-error">{state.error}</p>}{state.ok && <p className="form-success">{state.ok}</p>}</article>;
}

export function DailyTrainingManager({ date, rows }: { date: string; rows: DailyTrainingRow[] }) {
  return <><form method="get" className="daily-date-filter"><label>Training date<input type="date" name="trainingDate" value={date} onChange={(event) => event.currentTarget.form?.requestSubmit()} /></label><span>{rows.filter((row) => row.adminPassed ?? row.actualPassed).length}/{rows.length} passed</span></form><div className="daily-training-list"><div className="daily-training-head"><span>Team member</span><span>Daily status</span><span>Administrator override</span><span>Reset</span></div>{rows.map((row) => <TrainingRow key={row.id} row={row} date={date} />)}</div></>;
}
