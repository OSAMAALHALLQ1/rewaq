import { z } from "zod";

export const ownerPasswordLoginSchema = z.object({
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const employeeCodeLoginSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(6, "أدخل كود الموظف")
    .max(32, "كود الموظف غير صالح")
    .transform((value) => value.toUpperCase()),
});
