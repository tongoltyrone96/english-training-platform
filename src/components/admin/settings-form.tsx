"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/app/admin/actions";

type Settings = { trainingQuestionCount: number; trainingTimeLimitSec: number; trainingPassScore: string; trainingRandomOrder: boolean; trainingAutoAdvance: boolean; timeZone: string };

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(updateSettingsAction, {});
  return <form action={action} className="admin-form settings-form"><input type="hidden" name="trainingRandomOrder" value="on" /><div className="form-row three"><label>문제 수<input name="trainingQuestionCount" type="number" min="1" max="100" defaultValue={settings.trainingQuestionCount} /></label><label>제한시간(초)<input name="trainingTimeLimitSec" type="number" min="5" max="300" defaultValue={settings.trainingTimeLimitSec} /></label><label>통과점수<input name="trainingPassScore" type="number" min="0" max="5" step="0.1" defaultValue={settings.trainingPassScore} /></label></div><label>운영 시간대<input name="timeZone" defaultValue={settings.timeZone} /></label><div className="check-row"><label><input type="checkbox" checked disabled /> 문제 순서 무작위 (항상 적용)</label><label><input type="checkbox" name="trainingAutoAdvance" defaultChecked={settings.trainingAutoAdvance} /> 통과 후 자동 이동</label></div>{state.error && <p className="form-error">{state.error}</p>}{state.ok && <p className="form-success">{state.ok}</p>}<button className="primary-button" disabled={pending}>{pending ? "저장 중…" : "설정 저장"}</button></form>;
}
