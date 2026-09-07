import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function getActiveUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findFirst({ where: { id: session.user.id, status: "ACTIVE" }, select: { id: true, name: true, email: true, role: true } });
}

export async function requireUser() {
  const user = await getActiveUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
