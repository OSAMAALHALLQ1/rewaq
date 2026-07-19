import { expect, test } from "@playwright/test";

test("renders the email-free login with owner and employee tabs", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();

  // No email input anywhere on the page.
  await expect(page.locator('input[type="email"], input[name="email"]')).toHaveCount(0);

  // Owner tab is the default: a single password field.
  await expect(page.getByLabel("كلمة مرور المالك")).toBeVisible();
  await expect(page.getByRole("button", { name: "دخول المالك", exact: true }).last()).toBeVisible();

  // Employee tab: invite code only — no password field.
  await page.getByRole("button", { name: "دخول الموظف" }).first().click();
  await expect(page.getByLabel("كود الموظف")).toBeVisible();
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveCount(0);

  // The 8-hour free trial entry stays available.
  await expect(
    page.getByRole("button", { name: "دخول تجريبي مجاني لمدة 8 ساعات" }),
  ).toBeVisible();
});
