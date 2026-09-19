"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/app/admin/actions";

type Settings = { trainingQuestionCount: number; trainingTimeLimitSec: number; trainingPassScore: string; trainingRandomOrder: boolean; trainingAutoAdvance: boolean; timeZone: string };

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(updateSettingsAction, {});
  return <form action={action} className="admin-form settings-form"><input type="hidden" name="trainingRandomOrder" value="on" /><div className="form-row three"><label>Question count<input name="trainingQuestionCount" type="number" min="1" max="100" defaultValue={settings.trainingQuestionCount} /></label><label>Time limit (sec)<input name="trainingTimeLimitSec" type="number" min="5" max="300" defaultValue={settings.trainingTimeLimitSec} /></label><label>Pass score<input name="trainingPassScore" type="number" min="0" max="5" step="0.1" defaultValue={settings.trainingPassScore} /></label></div><label>Operating time zone<input name="timeZone" defaultValue={settings.timeZone} /></label><div className="check-row"><label><input type="checkbox" checked disabled /> Randomise question order (always on)</label><label><input type="checkbox" name="trainingAutoAdvance" defaultChecked={settings.trainingAutoAdvance} /> Advance automatically after a pass</label></div>{state.error && <p className="form-error">{state.error}</p>}{state.ok && <p className="form-success">{state.ok}</p>}<button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button></form>;
}
