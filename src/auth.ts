import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { credentialsSchema } from "@/lib/validation/auth";
import { consumeRateLimit, requestIdentifier } from "@/lib/rate-limit";

const secureCookies = process.env.AUTH_SECURE_COOKIES === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in" },
  cookies: {
    sessionToken: {
      name: secureCookies ? "__Secure-et.session" : "et.session",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: secureCookies },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        if (!(await consumeRateLimit("sign-in", requestIdentifier(request), 10, 15 * 60_000))) return null;
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || user.status !== "ACTIVE" || !(await compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.id = user.id!; token.role = user.role; }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.id);
      session.user.role = token.role as Role;
      return session;
    },
  },
});
