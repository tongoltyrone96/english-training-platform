import { describe, expect, it } from "vitest";
import { db } from "./db";

describe("database invariants", () => {
  it("prevents a second exam attempt for the same user, exam and ISO week", async () => {
    const operation = db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: `exam-${crypto.randomUUID()}@test.local`, name: "DB Test", passwordHash: "not-used" } });
      const exam = await tx.exam.create({ data: { name: "Constraint Test", questionCount: 1 } });
      await tx.examAttempt.create({ data: { userId: user.id, examId: exam.id, weekKey: "2099-W01", questionOrder: [] } });
      await tx.examAttempt.create({ data: { userId: user.id, examId: exam.id, weekKey: "2099-W01", questionOrder: [] } });
    });
    await expect(operation).rejects.toMatchObject({ code: "P2002" });
  });

  it("prevents duplicate Training submissions by idempotency key", async () => {
    const idempotencyKey = crypto.randomUUID();
    const operation = db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: `training-${crypto.randomUUID()}@test.local`, name: "DB Test", passwordHash: "not-used" } });
      const sentence = await tx.sentence.create({ data: { korean: "테스트 문장", primaryAnswer: "A test sentence.", alternateAnswers: [], keywords: [] } });
      const session = await tx.trainingSession.create({ data: { userId: user.id, localDate: new Date("2099-01-01T00:00:00Z"), settingsSnapshot: {} } });
      const item = await tx.trainingSessionItem.create({ data: { sessionId: session.id, sentenceId: sentence.id, position: 0 } });
      await tx.trainingAttempt.create({ data: { userId: user.id, sessionItemId: item.id, idempotencyKey, status: "SUBMITTED", startedAt: new Date() } });
      await tx.trainingAttempt.create({ data: { userId: user.id, sessionItemId: item.id, idempotencyKey, status: "SUBMITTED", startedAt: new Date() } });
    });
    await expect(operation).rejects.toMatchObject({ code: "P2002" });
  });
});
