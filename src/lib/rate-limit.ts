import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export async function consumeRateLimit(scope: string, identifier: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now(); const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = createHash("sha256").update(`${scope}:${identifier}:${windowStart}`).digest("hex");
  const bucket = await db.rateLimitBucket.upsert({ where: { id }, create: { id, count: 1, expiresAt: new Date(windowStart + windowMs * 2) }, update: { count: { increment: 1 } } });
  return bucket.count <= limit;
}

export function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
