import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <div className="app-shell dashboard-shell admin-shell">
    <aside className="dashboard-sidebar">
      <Link href="/dashboard" className="sidebar-brand"><span>ET</span><strong>English Training</strong></Link>
      <nav aria-label="Main navigation"><Link href="/dashboard"><span>⌂</span>Dashboard</Link><Link className="active" href="/admin"><span>◇</span>Admin</Link></nav>
      <div className="sidebar-account"><div className="sidebar-avatar">{user.name.slice(0,1).toUpperCase()}</div><span><strong>{user.name}</strong><small>Administrator</small></span><SignOutButton /></div>
    </aside>
    <div className="dashboard-content">{children}</div>
  </div>;
}
