import { expect, test } from "@playwright/test";

test("renders secure owner and employee login paths", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "سجّل دخولك إلى رواق" })).toBeVisible();

  // Restaurant owners authenticate with their own Supabase credentials.
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "دخول لوحة الإدارة" })).toBeVisible();

  // Employees use their permanent scoped code without an owner password.
  await page.getByRole("button", { name: "دخول الموظف" }).first().click();
  await expect(page.getByLabel("كود الموظف الدائم")).toBeVisible();
  await expect(page.locator('input[type="email"], input[name="email"]')).toHaveCount(0);
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveCount(0);

  // The 8-hour free trial entry stays available.
  await expect(
    page.getByRole("button", { name: "دخول تجريبي مجاني لمدة 8 ساعات" }),
  ).toBeVisible();
});
