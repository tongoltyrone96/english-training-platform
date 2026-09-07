import { expect, test } from "@playwright/test";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const email = `e2e-${crypto.randomUUID()}@test.local`;
const password = "E2e-password-2026!";

test.beforeAll(async () => {
  await db.user.create({ data: { email, name: "E2E Learner", passwordHash: await hash(password, 4), role: "USER" } });
});

test.afterAll(async () => {
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
});

test("renders sign-in and redirects protected dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "다시 만나 반가워요" })).toBeVisible();
});

test("rejects an invalid invitation code", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("이름").fill("Invalid Invite");
  await page.getByLabel("이메일").fill(`invalid-${crypto.randomUUID()}@test.local`);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByLabel("초대코드").fill("definitely-invalid");
  await page.getByRole("button", { name: "계정 만들기" }).click();
  await expect(page.getByRole("alert")).toContainText("초대코드가 유효하지 않습니다");
});

test("signs in a user and enforces server-side admin RBAC", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /오늘도 한 문장씩/ })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);
});
