import "server-only";

import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { isDemoUserEmail } from "@/lib/auth/demo";
import type { AuthenticatedUser } from "@/lib/auth/require-auth";

export type OrganizationPlanSelection = {
  selected: boolean;
  planCode: string;
  selectedAt: string | null;
};

export async function getOrganizationPlanSelection(
  user: Pick<AuthenticatedUser, "email" | "organizationId">,
): Promise<OrganizationPlanSelection> {
  if (isDemoUserEmail(user.email)) {
    return { selected: true, planCode: "scale", selectedAt: null };
  }

  if (!hasSupabaseAdminEnv()) {
    throw new Error("تعذر التحقق من اختيار الباقة لأن اتصال Supabase الإداري غير مهيأ.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("plan, plan_selected_at")
    .eq("id", user.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`تعذر التحقق من اختيار الباقة: ${error.message}`);
  }

  if (!data) {
    throw new Error("المؤسسة المرتبطة بالمستخدم غير موجودة.");
  }

  return {
    selected: Boolean(data.plan_selected_at),
    planCode: String(data.plan ?? "starter"),
    selectedAt: data.plan_selected_at,
  };
}
