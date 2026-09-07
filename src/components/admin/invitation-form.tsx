"use client";

import { useActionState } from "react";
import { createInvitationAction } from "@/app/admin/actions";

export function InvitationForm() {
  const [state, action, pending] = useActionState(createInvitationAction, {});
  return <form action={action} className="admin-form"><div className="form-row three"><label>용도<input name="label" defaultValue="Team invitation" required /></label><label>최대 사용 횟수<input name="maxUses" type="number" min="1" max="100" defaultValue="6" /></label><label>만료일<input name="expiresAt" type="date" /></label></div>{state.error && <p className="form-error">{state.error}</p>}{state.ok && <p className="form-success">{state.ok}</p>}{state.createdCode && <output className="invitation-code" aria-label="새 초대코드">{state.createdCode}</output>}<button className="primary-button" disabled={pending}>{pending ? "생성 중…" : "안전한 초대코드 생성"}</button></form>;
}
