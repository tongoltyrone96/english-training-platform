"use client";

import { useActionState } from "react";
import { replaceTrainingDocxAction } from "@/app/admin/actions";

export function DocxImporter() {
  const [state, action, pending] = useActionState(replaceTrainingDocxAction, {});
  return <form action={action} className="upload-box docx-submit"><label>DOCX file<input name="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></label><small>Submitting replaces the active training set with every valid sentence in this document. Maximum 5 MB.</small><button className="primary-button" disabled={pending}>{pending ? "Replacing…" : "Submit"}</button>{state.error && <p className="form-error" role="alert">{state.error}</p>}{state.ok && <p className="form-success" role="status">{state.ok}</p>}</form>;
}
