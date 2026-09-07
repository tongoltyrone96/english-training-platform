import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signUpAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default async function SignUpPage() {
  if (await auth()) redirect("/dashboard");
  return <AuthShell><section className="auth-card glass-card glass-card-signup"><div className="glass-brand">English Training</div><div className="glass-copy"><h1>Create account</h1></div><AuthForm mode="sign-up" action={signUpAction} /><p className="switch-link">Already have an account? <Link href="/sign-in">Sign in</Link></p></section></AuthShell>;
}
