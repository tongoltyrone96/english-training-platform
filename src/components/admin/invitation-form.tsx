"use client";

import { useActionState } from "react";
import { createInvitationAction } from "@/app/admin/actions";

export function InvitationForm() {
  const [state, action, pending] = useActionState(createInvitationAction, {});
  return <form action={action} className="admin-form"><div className="form-row three"><label>Purpose<input name="label" defaultValue="Team invitation" required /></label><label>Maximum uses<input name="maxUses" type="number" min="1" max="100" defaultValue="6" /></label><label>Expiry date<input name="expiresAt" type="date" /></label></div>{state.error && <p className="form-error">{state.error}</p>}{state.ok && <p className="form-success">{state.ok}</p>}{state.createdCode && <output className="invitation-code" aria-label="New invitation code">{state.createdCode}</output>}<button className="primary-button" disabled={pending}>{pending ? "Creating…" : "Create a secure invitation code"}</button></form>;
}
