"use client";

import { useActionState } from "react";
import type { AdminState } from "@/app/admin/actions";

export function SciTechPresentationForm({ users, action }: { users: Array<{ id: string; name: string }>; action: (state: AdminState, data: FormData) => Promise<AdminState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="admin-form"><div className="form-row"><label>Presentation date and weekday<input name="localDate" type="date" required /></label><label>Presenter<select name="presenterId" required defaultValue=""><option value="" disabled>Select a team member</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></div><label>Presentation title<input name="title" maxLength={160} placeholder="e.g. Generative AI in manufacturing" required /></label><label>Preparation notes<textarea name="description" maxLength={1000} placeholder="Optional context or preparation instructions" /></label><small className="schedule-note">The weekday follows the selected date. Upload deadline is 11:59 PM on the previous day.</small>{state.error && <p className="form-error">{state.error}</p>}{state.ok && <p className="form-success">{state.ok}</p>}<button className="primary-button" disabled={pending || users.length === 0}>{pending ? "Saving…" : "Save presentation schedule"}</button></form>;
}
