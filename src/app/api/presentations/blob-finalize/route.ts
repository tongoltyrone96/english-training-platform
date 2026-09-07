import { createHash } from "node:crypto";
import path from "node:path";
import { del, head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { PRESENTATION_MAX_BYTES } from "@/lib/presentation-storage";

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let uploadedUrl = "";
  try {
    const body = await request.json();
    const presentationId = String(body.presentationId || "");
    const originalName = String(body.originalName || "").slice(0, 255);
    uploadedUrl = String(body.url || "");
    const pathname = String(body.pathname || "");
    const extension = path.extname(originalName).toLowerCase();
    if (!uploadedUrl.startsWith("https://") || !pathname.startsWith(`presentations/${presentationId}/`) || ![".ppt", ".pptx", ".pdf"].includes(extension)) throw new Error("Invalid uploaded file.");
    const presentation = await db.sciTechPresentation.findUnique({ where: { id: presentationId }, include: { files: { orderBy: { version: "desc" }, take: 1 } } });
    if (!presentation || (presentation.presenterId !== user.id && user.role !== "ADMIN")) throw new Error("Upload forbidden.");
    if (user.role !== "ADMIN" && presentation.submissionDeadline && new Date() > presentation.submissionDeadline) throw new Error("Upload deadline passed.");
    const metadata = await head(uploadedUrl);
    if (metadata.pathname !== pathname || metadata.size < 1 || metadata.size > PRESENTATION_MAX_BYTES) throw new Error("Invalid uploaded file.");
    const version = (presentation.files[0]?.version ?? 0) + 1;
    await db.$transaction(async (tx) => {
      await tx.presentationFile.updateMany({ where: { presentationId, active: true }, data: { active: false } });
      const created = await tx.presentationFile.create({ data: { presentationId, uploadedById: user.id, originalName, storedName: pathname, storagePath: uploadedUrl, mimeType: metadata.contentType, sizeBytes: metadata.size, sha256: createHash("sha256").update(`${metadata.etag}:${uploadedUrl}`).digest("hex"), version } });
      await tx.sciTechPresentation.update({ where: { id: presentationId }, data: { submittedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PRESENTATION_FILE_UPLOAD", entityType: "PresentationFile", entityId: created.id, metadata: { presentationId, version, sizeBytes: metadata.size, storage: "vercel-blob" } } });
    });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    if (uploadedUrl.startsWith("https://")) await del(uploadedUrl).catch(() => undefined);
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Upload could not be finalized." }, { status: 400 });
  }
}
