import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveUser } from "@/lib/authz";
import { loadPresentationFile } from "@/lib/presentation-storage";

export async function GET(_: Request, { params }: { params: Promise<{ presentationId: string }> }) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { presentationId } = await params;
  const file = await db.presentationFile.findFirst({ where: { presentationId, active: true }, orderBy: { version: "desc" } });
  if (!file) return NextResponse.json({ error: "Presentation file not found." }, { status: 404 });
  try {
    const stored = await loadPresentationFile(file.storagePath);
    const safeName = file.originalName.replace(/[\r\n"]/g, "_");
    return new Response(stored.body, { headers: { "Content-Type": file.mimeType, "Content-Length": String(stored.size), "Content-Disposition": `attachment; filename="${safeName.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return NextResponse.json({ error: "The stored file is unavailable. Contact an administrator." }, { status: 410 }); }
}
