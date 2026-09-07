"use server";

import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { credentialsSchema, signUpSchema } from "@/lib/validation/auth";
import { headers } from "next/headers";
import { consumeRateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string };

export async function signInAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please check your email and password." };
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "The email or password is incorrect." };
    throw error;
  }
  return {};
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/sign-in" });
}

export async function signUpAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const requestHeaders = await headers();
  const identifier = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  if (!(await consumeRateLimit("sign-up", identifier, 5, 15 * 60_000))) return { error: "Too many sign-up attempts. Please try again later." };
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check your details. The password must contain at least 10 characters." };

  const { email, name, password, invitationCode } = parsed.data;
  // bcrypt hashes are salted, so candidate invitation rows must be compared in the transaction.
  try {
    await db.$transaction(async (tx) => {
      const { compare } = await import("bcryptjs");
      const invitations = await tx.invitation.findMany({ where: { active: true } });
      const invitation = (await Promise.all(invitations.map(async (item) => (await compare(invitationCode, item.codeHash)) ? item : null))).find(Boolean);
      if (!invitation || invitation.uses >= invitation.maxUses || (invitation.expiresAt && invitation.expiresAt <= new Date())) {
        throw new Error("INVALID_INVITATION");
      }
      const user = await tx.user.create({ data: { email, name, passwordHash: await hash(password, 12) } });
      await tx.invitation.update({ where: { id: invitation.id }, data: { uses: { increment: 1 } } });

      if (email === process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()) {
        await tx.adminBootstrap.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
        const claimed = await tx.adminBootstrap.updateMany({
          where: { id: 1, claimedById: null },
          data: { claimedById: user.id, claimedAt: new Date() },
        });
        if (claimed.count === 1) await tx.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "An account already exists for this email." };
    if (error instanceof Error && error.message === "INVALID_INVITATION") return { error: "The invitation code is invalid or has expired." };
    return { error: "We couldn't create your account. Please try again later." };
  }
  redirect("/sign-in?created=1");
}
