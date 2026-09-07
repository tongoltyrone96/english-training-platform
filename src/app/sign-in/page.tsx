import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default async function SignInPage() {
  if (await auth()) redirect("/dashboard");
  return <AuthShell>
    <section className="auth-card glass-card">
      <div className="glass-brand">English Training</div>
      <div className="glass-copy"><h1>Login</h1></div>
      <AuthForm mode="sign-in" action={signInAction} />
      <p className="switch-link">Don&apos;t have an account yet? <Link href="/sign-up">Register for free</Link></p>
    </section>
  </AuthShell>;
}
