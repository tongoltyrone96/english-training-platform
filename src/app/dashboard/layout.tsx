import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <div className="app-shell dashboard-shell">
    <aside className="dashboard-sidebar">
      <Link href="/dashboard" className="sidebar-brand"><span>ET</span><strong>English Training</strong></Link>
      <nav aria-label="Main navigation"><Link className="active" href="/dashboard"><span>⌂</span>Dashboard</Link>{user.role === "ADMIN" && <Link href="/admin"><span>◇</span>Admin</Link>}</nav>
      <div className="sidebar-account"><div className="sidebar-avatar">{user.name.slice(0,1).toUpperCase()}</div><span><strong>{user.name}</strong><small>{user.role === "ADMIN" ? "Administrator" : "Learner"}</small></span><SignOutButton /></div>
    </aside>
    <div className="dashboard-content">{children}</div>
  </div>;
}
