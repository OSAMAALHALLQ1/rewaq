import { z } from "zod";
import { normalizeEmployeeCode } from "@/lib/auth/employee-code";

export const employeeCodeLoginSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(6, "أدخل كود الموظف")
    .max(64, "كود الموظف غير صالح")
    .transform(normalizeEmployeeCode)
    .refine((value) => /^[A-Z0-9_-]+$/.test(value), "كود الموظف غير صالح"),
});
