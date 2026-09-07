import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const code = process.env.INITIAL_INVITATION_CODE;
  if (!code || code.length < 8) throw new Error("INITIAL_INVITATION_CODE must contain at least 8 characters");
  await db.appSettings.upsert({ where: { id: 1 }, create: { id: 1, timeZone: process.env.APP_TIME_ZONE ?? "Europe/London" }, update: {} });
  await db.adminBootstrap.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const existing = await db.invitation.findFirst({ where: { label: "Initial team invitation" } });
  if (!existing) await db.invitation.create({ data: { label: "Initial team invitation", codeHash: await hash(code, 12), maxUses: 10 } });
  await db.promptVersion.upsert({ where: { id: "language-rubric-v1" }, create: { id: "language-rubric-v1", active: true, rubric: { meaning: 35, grammar: 15, naturalness: 10 } }, update: {} });
  await db.sentence.createMany({
    skipDuplicates: true,
    data: [
      { id: "starter-01", korean: "오늘 회의는 오전 열 시에 시작합니다.", primaryAnswer: "Today's meeting starts at ten in the morning.", alternateAnswers: ["The meeting starts at 10 a.m. today."], keywords: ["meeting", "starts", "ten"], category: "work", usage: "BOTH" },
      { id: "starter-02", korean: "이 자료를 금요일까지 검토해 주세요.", primaryAnswer: "Please review this material by Friday.", alternateAnswers: ["Please review these materials by Friday."], keywords: ["review", "by Friday"], category: "work", usage: "BOTH" },
      { id: "starter-03", korean: "일정을 다음 주로 변경할 수 있을까요?", primaryAnswer: "Could we move the schedule to next week?", alternateAnswers: ["Can we reschedule it for next week?"], keywords: ["schedule", "next week"], category: "work", usage: "BOTH" },
      { id: "starter-04", korean: "제가 확인한 후 다시 연락드리겠습니다.", primaryAnswer: "I'll check and get back to you.", alternateAnswers: ["I will check and contact you again."], keywords: ["check", "get back"], category: "work", usage: "BOTH" },
      { id: "starter-05", korean: "이 부분을 조금 더 자세히 설명해 주시겠어요?", primaryAnswer: "Could you explain this part in more detail?", alternateAnswers: ["Could you elaborate on this part?"], keywords: ["explain", "detail"], category: "conversation", usage: "BOTH" },
      { id: "starter-06", korean: "도움을 주셔서 정말 감사합니다.", primaryAnswer: "Thank you very much for your help.", alternateAnswers: ["I really appreciate your help."], keywords: ["thank", "help"], category: "conversation", usage: "BOTH" },
      { id: "starter-07", korean: "현재 진행 상황을 공유해 주세요.", primaryAnswer: "Please share the current progress.", alternateAnswers: ["Please give me an update on the current progress."], keywords: ["share", "progress"], category: "work", usage: "BOTH" },
      { id: "starter-08", korean: "예상보다 시간이 조금 더 필요합니다.", primaryAnswer: "We need a little more time than expected.", alternateAnswers: ["It will take a little longer than expected."], keywords: ["more time", "expected"], category: "work", usage: "BOTH" },
      { id: "starter-09", korean: "좋은 의견이라고 생각합니다.", primaryAnswer: "I think that's a good idea.", alternateAnswers: ["I think that is a good suggestion."], keywords: ["think", "good"], category: "conversation", usage: "BOTH" },
      { id: "starter-10", korean: "궁금한 점이 있으면 언제든지 말씀해 주세요.", primaryAnswer: "Please let me know if you have any questions.", alternateAnswers: ["Feel free to ask if you have any questions."], keywords: ["questions", "let me know"], category: "conversation", usage: "BOTH" },
    ],
  });
}

main().finally(() => db.$disconnect());
