"use server";

import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseSentenceDocx, type ParsedSentence } from "@/lib/docx";
import { requireAdmin } from "@/lib/authz";
import { localDateTimeToUtc } from "@/lib/time";
import type { Prisma } from "@prisma/client";

export type AdminState = { ok?: string; error?: string; createdCode?: string };
export type ImportState = AdminState & { importId?: string; entries?: ParsedSentence[]; errors?: string[] };

const dailyOverrideSchema = z.object({ userId: z.string().cuid(), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), score: z.coerce.number().min(0).max(5), passed: z.string().optional().transform(Boolean) });

export async function saveDailyTrainingOverrideAction(_: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = dailyOverrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a score from 0 to 5 and a valid date." };
  const user = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!user) return { error: "The selected user no longer exists." };
  const localDate = new Date(`${parsed.data.localDate}T00:00:00.000Z`);
  await db.dailyProgress.upsert({ where: { userId_localDate: { userId: user.id, localDate } }, create: { userId: user.id, localDate, adminScore: parsed.data.score, adminPassed: parsed.data.passed }, update: { adminScore: parsed.data.score, adminPassed: parsed.data.passed } });
  revalidatePath("/admin"); revalidatePath("/dashboard");
  return { ok: "Daily result updated." };
}

export async function clearDailyTrainingOverrideAction(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ userId: z.string().cuid(), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const localDate = new Date(`${parsed.data.localDate}T00:00:00.000Z`);
  await db.dailyProgress.updateMany({ where: { userId: parsed.data.userId, localDate }, data: { adminScore: null, adminPassed: null } });
  revalidatePath("/admin"); revalidatePath("/dashboard");
}

async function refreshOpenTrainingSessions(tx: Prisma.TransactionClient) {
  const [sessions, activeSentences] = await Promise.all([
    tx.trainingSession.findMany({ where: { status: "ACTIVE" }, include: { items: { where: { passedAt: null }, orderBy: { position: "asc" } } } }),
    tx.sentence.findMany({ where: { active: true, usage: { in: ["TRAINING", "BOTH"] } }, select: { id: true } }),
  ]);
  if (!activeSentences.length) return 0;
  for (const session of sessions) {
    const pool = [...activeSentences];
    for (let index = pool.length - 1; index > 0; index--) { const swap = randomBytes(4).readUInt32BE(0) % (index + 1); [pool[index], pool[swap]] = [pool[swap], pool[index]]; }
    for (let index = 0; index < session.items.length; index++) await tx.trainingSessionItem.update({ where: { id: session.items[index].id }, data: { sentenceId: pool[index % pool.length].id } });
  }
  return sessions.length;
}

export async function scheduleSciTechPresentationAction(_: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), presenterId: z.string().cuid(), title: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid date, presenter and presentation title." };
  const presenter = await db.user.findFirst({ where: { id: parsed.data.presenterId, status: "ACTIVE" }, select: { id: true } });
  if (!presenter) return { error: "The selected presenter is not active." };
  const localDate = new Date(`${parsed.data.localDate}T00:00:00.000Z`);
  const deadlineDate = new Date(localDate); deadlineDate.setUTCDate(deadlineDate.getUTCDate() - 1);
  const settings = await db.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const submissionDeadline = localDateTimeToUtc(deadlineDate.getUTCFullYear(), deadlineDate.getUTCMonth() + 1, deadlineDate.getUTCDate(), 23, 59, settings.timeZone);
  const existing = await db.sciTechPresentation.findUnique({ where: { localDate }, select: { id: true, _count: { select: { ratings: true, files: true } } } });
  if (existing?._count.ratings || existing?._count.files) return { error: "The schedule cannot be changed after a file or rating has been submitted." };
  const presentation = await db.sciTechPresentation.upsert({ where: { localDate }, create: { localDate, presenterId: presenter.id, title: parsed.data.title, description: parsed.data.description || null, submissionDeadline, createdById: admin.id }, update: { presenterId: presenter.id, title: parsed.data.title, description: parsed.data.description || null, submissionDeadline, createdById: admin.id } });
  await db.auditLog.create({ data: { actorId: admin.id, action: "SCI_TECH_PRESENTER_SCHEDULE", entityType: "SciTechPresentation", entityId: presentation.id, metadata: parsed.data } });
  revalidatePath("/admin"); revalidatePath("/dashboard");
  return { ok: "The presenter has been scheduled." };
}

const sentenceSchema = z.object({
  korean: z.string().trim().min(1).max(300),
  primaryAnswer: z.string().trim().min(1).max(500),
  alternateAnswers: z.string().transform((v) => v.split("\n").map((x) => x.trim()).filter(Boolean)),
  keywords: z.string().transform((v) => v.split(",").map((x) => x.trim()).filter(Boolean)),
  category: z.string().trim().min(1).max(60),
  difficulty: z.coerce.number().int().min(1).max(5),
  usage: z.enum(["TRAINING", "TEST", "BOTH"]),
});

export async function createSentenceAction(_: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = sentenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "문장 입력값을 확인해 주세요." };
  try {
    const sentence = await db.sentence.create({ data: parsed.data });
    await db.auditLog.create({ data: { actorId: admin.id, action: "SENTENCE_CREATE", entityType: "Sentence", entityId: sentence.id } });
    revalidatePath("/admin");
    return { ok: "문장을 저장했습니다." };
  } catch { return { error: "중복 문장이거나 저장할 수 없는 값입니다." }; }
}

export async function toggleSentenceAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.string().cuid().parse(formData.get("id"));
  const current = await db.sentence.findUniqueOrThrow({ where: { id }, select: { active: true } });
  await db.$transaction([
    db.sentence.update({ where: { id }, data: { active: !current.active } }),
    db.auditLog.create({ data: { actorId: admin.id, action: current.active ? "SENTENCE_DEACTIVATE" : "SENTENCE_ACTIVATE", entityType: "Sentence", entityId: id } }),
  ]);
  revalidatePath("/admin");
}

export async function updateSentenceAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.string().cuid().safeParse(formData.get("id"));
  const parsed = sentenceSchema.safeParse(Object.fromEntries(formData));
  if (!id.success || !parsed.success) return;
  await db.$transaction([
    db.sentence.update({ where: { id: id.data }, data: parsed.data }),
    db.auditLog.create({ data: { actorId: admin.id, action: "SENTENCE_UPDATE", entityType: "Sentence", entityId: id.data } }),
  ]);
  revalidatePath("/admin");
}

export async function previewDocxAction(_: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "DOCX 파일을 선택해 주세요." };
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseSentenceDocx(file);
    const record = await db.documentImport.create({ data: {
      fileName: file.name,
      fileHash: createHash("sha256").update(bytes).digest("hex"),
      parsedData: parsed.entries,
      errors: parsed.errors,
      createdById: admin.id,
    } });
    await db.auditLog.create({ data: { actorId: admin.id, action: "DOCX_PREVIEW", entityType: "DocumentImport", entityId: record.id, metadata: { fileName: file.name, pairs: parsed.entries.length } } });
    return { importId: record.id, entries: parsed.entries, errors: parsed.errors };
  } catch (error) {
    const messages: Record<string, string> = { DOCX_EXTENSION: ".docx 파일만 지원합니다.", DOCX_MIME: "파일 형식이 DOCX가 아닙니다.", DOCX_SIZE: "파일은 5MB 이하이며 비어 있지 않아야 합니다.", DOCX_SIGNATURE: "DOCX 파일 signature가 올바르지 않습니다.", DOCX_CORRUPT: "손상되었거나 읽을 수 없는 DOCX입니다." };
    return { error: messages[error instanceof Error ? error.message : ""] ?? "DOCX를 분석하지 못했습니다." };
  }
}

export async function replaceTrainingDocxAction(_: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Select a DOCX file." };
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseSentenceDocx(file);
    const entries = parsed.entries.filter((entry) => entry.issues.length === 0);
    if (!entries.length) return { error: "No valid Korean and English sentence pairs were found." };
    const uniqueEntries = [...new Map(entries.map((entry) => [`${entry.korean}\u0000${entry.english}`.toLocaleLowerCase(), entry])).values()];
    await db.$transaction(async (tx) => {
      const record = await tx.documentImport.create({ data: { fileName: file.name, fileHash: createHash("sha256").update(bytes).digest("hex"), status: "IMPORTED", parsedData: parsed.entries, errors: parsed.errors, importedCount: uniqueEntries.length, createdById: admin.id, completedAt: new Date() } });
      await tx.sentence.updateMany({ where: { active: true }, data: { active: false } });
      for (const entry of uniqueEntries) await tx.sentence.upsert({ where: { korean_primaryAnswer: { korean: entry.korean, primaryAnswer: entry.english } }, create: { korean: entry.korean, primaryAnswer: entry.english, alternateAnswers: [], keywords: [], importId: record.id, active: true, usage: "TRAINING" }, update: { active: true, usage: "TRAINING", importId: record.id } });
      await refreshOpenTrainingSessions(tx);
      await tx.appSettings.upsert({ where: { id: 1 }, create: { id: 1, trainingRandomOrder: true }, update: { trainingRandomOrder: true } });
      await tx.auditLog.create({ data: { actorId: admin.id, action: "DOCX_REPLACE_TRAINING_POOL", entityType: "DocumentImport", entityId: record.id, metadata: { importedCount: uniqueEntries.length, skippedCount: parsed.entries.length - uniqueEntries.length, previousQuestionsDeactivated: true, randomOrderEnabled: true } } });
    });
    revalidatePath("/admin"); revalidatePath("/dashboard");
    const skipped = parsed.entries.length - uniqueEntries.length;
    return { ok: `${uniqueEntries.length} sentences replaced the previous training set${skipped ? ` (${skipped} invalid entries skipped)` : ""}.` };
  } catch (error) {
    const messages: Record<string, string> = { DOCX_EXTENSION: "Only .docx files are supported.", DOCX_MIME: "The selected file is not a DOCX file.", DOCX_SIZE: "The file must be non-empty and no larger than 5 MB.", DOCX_SIGNATURE: "The DOCX file signature is invalid.", DOCX_CORRUPT: "The DOCX file is damaged or cannot be read." };
    return { error: messages[error instanceof Error ? error.message : ""] ?? "The training questions could not be replaced." };
  }
}

export async function confirmDocxImportAction(_: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const importId = z.string().cuid().safeParse(formData.get("importId"));
  const selected = formData.getAll("selected").map(Number).filter(Number.isInteger);
  if (!importId.success || selected.length === 0) return { error: "저장할 문장을 선택해 주세요." };
  const record = await db.documentImport.findUnique({ where: { id: importId.data } });
  if (!record || record.status !== "PREVIEW") return { error: "이미 처리되었거나 존재하지 않는 가져오기입니다." };
  const entries = z.array(z.object({ korean: z.string(), english: z.string(), duplicate: z.boolean(), issues: z.array(z.string()) })).parse(record.parsedData);
  const chosen = [...new Set(selected)].map((index) => entries[index]).filter((entry) => entry && entry.issues.length === 0);
  if (chosen.length === 0) return { error: "오류가 없는 문장을 한 개 이상 선택해 주세요." };
  try {
    await db.$transaction(async (tx) => {
      await tx.sentence.updateMany({ where: { active: true }, data: { active: false } });
      for (const entry of chosen) await tx.sentence.upsert({ where: { korean_primaryAnswer: { korean: entry.korean, primaryAnswer: entry.english } }, create: { korean: entry.korean, primaryAnswer: entry.english, alternateAnswers: [], keywords: [], importId: record.id, active: true, usage: "TRAINING" }, update: { active: true, usage: "TRAINING", importId: record.id } });
      await refreshOpenTrainingSessions(tx);
      await tx.appSettings.upsert({ where: { id: 1 }, create: { id: 1, trainingRandomOrder: true }, update: { trainingRandomOrder: true } });
      await tx.documentImport.update({ where: { id: record.id }, data: { status: "IMPORTED", importedCount: chosen.length, completedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: admin.id, action: "DOCX_REPLACE_TRAINING_POOL", entityType: "DocumentImport", entityId: record.id, metadata: { importedCount: chosen.length, previousQuestionsDeactivated: true, randomOrderEnabled: true } } });
    });
    revalidatePath("/admin");
    return { ok: `기존 문제를 교체하고 새 문제 ${chosen.length}개를 활성화했습니다. 매일 무작위로 출제됩니다.` };
  } catch { return { error: "문제 교체 중 오류가 발생하여 모든 변경을 취소했습니다." }; }
}

const settingsSchema = z.object({
  trainingQuestionCount: z.coerce.number().int().min(1).max(100),
  trainingTimeLimitSec: z.coerce.number().int().min(5).max(300),
  trainingPassScore: z.coerce.number().min(0).max(5),
  timeZone: z.string().refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }),
  trainingRandomOrder: z.string().optional().transform(Boolean),
  trainingAutoAdvance: z.string().optional().transform(Boolean),
});

export async function updateSettingsAction(_: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "설정값의 범위를 확인해 주세요." };
  await db.$transaction([
    db.appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data }),
    db.auditLog.create({ data: { actorId: admin.id, action: "SETTINGS_UPDATE", entityType: "AppSettings", entityId: "1", metadata: parsed.data } }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: "설정을 저장했습니다. 현재 진행 중인 세션은 기존 기준을 유지하며, 새로 생성되는 세션부터 적용됩니다." };
}

const examSchema = z.object({
  name: z.string().trim().min(2).max(100),
  questionCount: z.coerce.number().int().min(1).max(100),
  timeLimitSec: z.coerce.number().int().min(5).max(300),
  passScore: z.coerce.number().min(0).max(5),
});

export async function createExamAction(_: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = examSchema.safeParse(Object.fromEntries(formData));
  const sentenceIds = [...new Set(formData.getAll("sentenceIds").map(String))];
  if (!parsed.success || sentenceIds.length !== parsed.data.questionCount) return { error: "문제 수와 선택한 문장 수가 같아야 합니다." };
  const count = await db.sentence.count({ where: { id: { in: sentenceIds }, active: true } });
  if (count !== sentenceIds.length) return { error: "사용할 수 없는 문장이 포함되어 있습니다." };
  await db.$transaction(async (tx) => {
    await tx.exam.updateMany({ where: { active: true }, data: { active: false } });
    const exam = await tx.exam.create({ data: { ...parsed.data, active: true, questions: { create: sentenceIds.map((sentenceId, position) => ({ sentenceId, position })) } } });
    await tx.auditLog.create({ data: { actorId: admin.id, action: "EXAM_ACTIVATE", entityType: "Exam", entityId: exam.id, metadata: { questionCount: parsed.data.questionCount } } });
  });
  revalidatePath("/admin");
  return { ok: "새 시험 세트를 활성화했습니다." };
}

const invitationSchema = z.object({ label: z.string().trim().min(2).max(80), maxUses: z.coerce.number().int().min(1).max(100), expiresAt: z.string().optional() });

export async function createInvitationAction(_: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin(); const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "초대코드 설정을 확인해 주세요." };
  const code = randomBytes(18).toString("base64url"); const expiresAt = parsed.data.expiresAt ? new Date(`${parsed.data.expiresAt}T23:59:59Z`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { error: "만료일이 올바르지 않습니다." };
  const invitation = await db.invitation.create({ data: { label: parsed.data.label, maxUses: parsed.data.maxUses, expiresAt, codeHash: await hash(code, 12) } });
  await db.auditLog.create({ data: { actorId: admin.id, action: "INVITATION_CREATE", entityType: "Invitation", entityId: invitation.id, metadata: { label: invitation.label, maxUses: invitation.maxUses } } });
  revalidatePath("/admin"); return { ok: "초대코드를 만들었습니다. 지금 안전하게 복사하세요.", createdCode: code };
}

export async function toggleInvitationAction(formData: FormData) {
  const admin = await requireAdmin(); const id = z.string().cuid().parse(formData.get("id")); const invitation = await db.invitation.findUniqueOrThrow({ where: { id } });
  await db.$transaction([db.invitation.update({ where: { id }, data: { active: !invitation.active } }), db.auditLog.create({ data: { actorId: admin.id, action: invitation.active ? "INVITATION_DEACTIVATE" : "INVITATION_ACTIVATE", entityType: "Invitation", entityId: id } })]); revalidatePath("/admin");
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireAdmin(); const parsed = z.object({ id: z.string().cuid(), role: z.enum(["ADMIN","USER"]), status: z.enum(["ACTIVE","INACTIVE"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.id === admin.id) return;
  await db.$transaction([db.user.update({ where: { id: parsed.data.id }, data: { role: parsed.data.role, status: parsed.data.status } }), db.auditLog.create({ data: { actorId: admin.id, action: "USER_UPDATE", entityType: "User", entityId: parsed.data.id, metadata: { role: parsed.data.role, status: parsed.data.status } } })]); revalidatePath("/admin");
}
