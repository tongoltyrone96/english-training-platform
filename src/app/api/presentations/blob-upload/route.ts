import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import path from "node:path";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { PRESENTATION_MAX_BYTES } from "@/lib/presentation-storage";

const contentTypes = ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/pdf", "application/octet-stream"];

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({ request, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getActiveUser();
        if (!user) throw new Error("Authentication required.");
        const presentationId = String(JSON.parse(clientPayload || "{}").presentationId || "");
        const presentation = await db.sciTechPresentation.findUnique({ where: { id: presentationId } });
        if (!presentation || (presentation.presenterId !== user.id && user.role !== "ADMIN")) throw new Error("Upload forbidden.");
        if (user.role !== "ADMIN" && presentation.submissionDeadline && new Date() > presentation.submissionDeadline) throw new Error("Upload deadline passed.");
        if (!pathname.startsWith(`presentations/${presentationId}/`) || ![".ppt", ".pptx", ".pdf"].includes(path.extname(pathname).toLowerCase())) throw new Error("Invalid presentation path.");
        return { allowedContentTypes: contentTypes, maximumSizeInBytes: PRESENTATION_MAX_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Upload authorization failed." }, { status: 400 });
  }
}
