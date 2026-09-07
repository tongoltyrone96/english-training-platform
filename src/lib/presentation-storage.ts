import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

export const PRESENTATION_MAX_BYTES = 30 * 1024 * 1024;
const allowedExtensions = new Set([".ppt", ".pptx", ".pdf"]);
const allowedMimes = new Set(["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/pdf", "application/octet-stream"]);

export function presentationStorageRoot() {
  return path.resolve(process.env.PRESENTATION_STORAGE_DIR || path.join(process.cwd(), "storage", "presentations"));
}

export function usesBlobStorage() { return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID); }

export function validatePresentationFile(file: File, bytes: Buffer) {
  const extension = path.extname(file.name).toLowerCase();
  if (!allowedExtensions.has(extension) || !allowedMimes.has(file.type || "application/octet-stream")) throw new Error("FILE_TYPE");
  if (!bytes.length || bytes.length > PRESENTATION_MAX_BYTES) throw new Error("FILE_SIZE");
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
  const ole = bytes.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));
  if ((extension === ".pptx" && !zip) || (extension === ".pdf" && !pdf) || (extension === ".ppt" && !ole)) throw new Error("FILE_SIGNATURE");
  return extension;
}

export async function storePresentationFile(file: File, presentationId: string, dateKey: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = validatePresentationFile(file, bytes);
  const storedName = `${dateKey.slice(0,4)}/${dateKey.slice(5,7)}/${dateKey}_${presentationId}/${randomUUID()}${extension}`;
  if (usesBlobStorage()) {
    const blob = await put(`presentations/${storedName}`, bytes, { access: "private", addRandomSuffix: false, contentType: file.type || "application/octet-stream" });
    return { storedName: blob.pathname, storagePath: blob.url, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), mimeType: file.type || "application/octet-stream" };
  }
  const folder = path.join(presentationStorageRoot(), dateKey.slice(0,4), dateKey.slice(5,7), `${dateKey}_${presentationId}`);
  await mkdir(folder, { recursive: true });
  const localName = path.basename(storedName); const storagePath = path.join(folder, localName);
  const temporaryPath = `${storagePath}.uploading`;
  try { await writeFile(temporaryPath, bytes, { flag: "wx" }); await rename(temporaryPath, storagePath); }
  catch (error) { await unlink(temporaryPath).catch(() => undefined); throw error; }
  return { storedName: localName, storagePath, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), mimeType: file.type || "application/octet-stream" };
}

export async function removePresentationFile(storagePath: string) {
  if (storagePath.startsWith("https://")) await del(storagePath); else await unlink(storagePath);
}

export async function loadPresentationFile(storagePath: string) {
  if (!storagePath.startsWith("https://")) { const { readFile } = await import("node:fs/promises"); const bytes = await readFile(storagePath); return { body: new Uint8Array(bytes) as BodyInit, size: bytes.length }; }
  const result = await get(storagePath, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) throw new Error("BLOB_NOT_FOUND");
  return { body: result.stream as BodyInit, size: result.blob.size };
}
