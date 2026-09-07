import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveUser } from "@/lib/authz";
import { removePresentationFile, storePresentationFile } from "@/lib/presentation-storage";

function dashboard(request: Request, notice: string) { return NextResponse.redirect(new URL(`/dashboard?notice=${notice}`, request.url), 303); }

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", request.url), 303);
  const form = await request.formData();
  const presentationId = String(form.get("presentationId") || "");
  const file = form.get("file");
  if (!(file instanceof File)) return dashboard(request, "presentation-file-required");
  const presentation = await db.sciTechPresentation.findUnique({ where: { id: presentationId }, include: { files: { orderBy: { version: "desc" }, take: 1 } } });
  if (!presentation || (presentation.presenterId !== user.id && user.role !== "ADMIN")) return dashboard(request, "presentation-upload-forbidden");
  if (user.role !== "ADMIN" && presentation.submissionDeadline && new Date() > presentation.submissionDeadline) return dashboard(request, "presentation-deadline-passed");
  let stored: Awaited<ReturnType<typeof storePresentationFile>> | undefined;
  try {
    const dateKey = presentation.localDate.toISOString().slice(0,10);
    const storedFile = await storePresentationFile(file, presentation.id, dateKey);
    stored = storedFile;
    const version = (presentation.files[0]?.version ?? 0) + 1;
    await db.$transaction(async (tx) => {
      await tx.presentationFile.updateMany({ where: { presentationId: presentation.id, active: true }, data: { active: false } });
      const created = await tx.presentationFile.create({ data: { presentationId: presentation.id, uploadedById: user.id, originalName: file.name.slice(0,255), version, ...storedFile } });
      await tx.sciTechPresentation.update({ where: { id: presentation.id }, data: { submittedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PRESENTATION_FILE_UPLOAD", entityType: "PresentationFile", entityId: created.id, metadata: { presentationId: presentation.id, version, sizeBytes: storedFile.sizeBytes, sha256: storedFile.sha256 } } });
    });
    return dashboard(request, "presentation-uploaded");
  } catch (error) {
    if (stored) await removePresentationFile(stored.storagePath).catch(() => undefined);
    const code = error instanceof Error ? error.message : "";
    return dashboard(request, code === "FILE_TYPE" || code === "FILE_SIGNATURE" ? "presentation-invalid-file" : code === "FILE_SIZE" ? "presentation-file-size" : "presentation-upload-failed");
  }
}
