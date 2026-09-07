import { signOutAction } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button className="ghost-button sidebar-sign-out" type="submit"><span aria-hidden="true">↪</span> Sign out</button>
    </form>
  );
}
