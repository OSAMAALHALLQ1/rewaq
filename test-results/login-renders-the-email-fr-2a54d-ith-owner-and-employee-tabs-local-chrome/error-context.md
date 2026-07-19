# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> renders the email-free login with owner and employee tabs
- Location: e2e\login.spec.ts:3:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByLabel('كلمة المرور', { exact: true })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByLabel('كلمة المرور', { exact: true })
    13 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - link "رواق" [ref=e4] [cursor=pointer]:
      - /url: /
      - img [ref=e6]
      - generic [ref=e9]: رواق
    - generic [ref=e10]:
      - generic [ref=e11]:
        - heading "تسجيل الدخول" [level=3] [ref=e12]
        - paragraph [ref=e13]: "لا حاجة لإدخال البريد الإلكتروني: المالك يدخل بكلمة المرور، والموظف بكود الموظف وكلمة المرور."
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]:
            - button "دخول المالك" [ref=e17] [cursor=pointer]:
              - img [ref=e18]
              - text: دخول المالك
            - button "دخول الموظف" [active] [ref=e21] [cursor=pointer]:
              - img [ref=e22]
              - text: دخول الموظف
          - generic [ref=e26]:
            - generic [ref=e27]:
              - generic [ref=e28]: كود الموظف
              - textbox "كود الموظف" [ref=e29]:
                - /placeholder: "مثال: AB12CD34"
            - generic [ref=e30]:
              - generic [ref=e31]: كلمة المرور
              - textbox "كلمة المرور" [ref=e32]
            - paragraph [ref=e33]: في أول دخول يثبّت الموظف كلمة مروره مع كود الدعوة، ثم يستخدم الخانتين نفسيهما في كل مرة.
            - button "دخول الموظف" [ref=e35] [cursor=pointer]
        - generic [ref=e40]: أو تجربة سريعة للنظام
        - button "دخول تجريبي مجاني لمدة 8 ساعات" [ref=e42] [cursor=pointer]:
          - img [ref=e43]
          - text: دخول تجريبي مجاني لمدة 8 ساعات
        - generic [ref=e46]:
          - text: ليس لديك حساب؟
          - link "إنشاء حساب" [ref=e47] [cursor=pointer]:
            - /url: /register
  - alert [ref=e48]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("renders the email-free login with owner and employee tabs", async ({ page }) => {
  4  |   await page.goto("/login");
  5  | 
  6  |   await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
  7  | 
  8  |   // No email input anywhere on the page.
  9  |   await expect(page.locator('input[type="email"], input[name="email"]')).toHaveCount(0);
  10 | 
  11 |   // Owner tab is the default: a single password field.
  12 |   await expect(page.getByLabel("كلمة مرور المالك")).toBeVisible();
  13 |   await expect(page.getByRole("button", { name: "دخول المالك", exact: true }).last()).toBeVisible();
  14 | 
  15 |   // Employee tab: invite code only — no password field.
  16 |   await page.getByRole("button", { name: "دخول الموظف" }).first().click();
  17 |   await expect(page.getByLabel("كود الموظف")).toBeVisible();
> 18 |   await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveCount(0);
     |                                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  19 | 
  20 |   // The 8-hour free trial entry stays available.
  21 |   await expect(
  22 |     page.getByRole("button", { name: "دخول تجريبي مجاني لمدة 8 ساعات" }),
  23 |   ).toBeVisible();
  24 | });
  25 | 
```