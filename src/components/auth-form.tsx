"use client";

import { useActionState } from "react";
import type { AuthState } from "@/app/actions/auth";

type Props = { mode: "sign-in" | "sign-up"; action: (state: AuthState, data: FormData) => Promise<AuthState> };

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const signup = mode === "sign-up";
  return (
    <form action={formAction} className="auth-form">
      {signup && <label>Name<input name="name" autoComplete="name" placeholder="Your name" required minLength={2} /></label>}
      <label>Email<input name="email" type="email" autoComplete="email" placeholder="username@gmail.com" required /></label>
      <label>Password<input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} placeholder="Password" required minLength={10} /></label>
      {signup && <label>Invitation code<input name="invitationCode" type="password" autoComplete="off" placeholder="Invitation code" required /></label>}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="primary-button" disabled={pending}>{pending ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
    </form>
  );
}
