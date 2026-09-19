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
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("rejects an invalid invitation code", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Invalid Invite");
  await page.getByLabel("Email").fill(`invalid-${crypto.randomUUID()}@test.local`);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Invitation code").fill("definitely-invalid");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("The invitation code is invalid or has expired.");
});

test("signs in a user and enforces server-side admin RBAC", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);
});
