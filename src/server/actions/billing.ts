"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isDemoUserEmail } from "@/lib/auth/demo";
import { requireAuth } from "@/lib/auth/require-auth";
import { isRewaqPlanCode } from "@/lib/billing/plans";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export async function selectTrialPlanAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const planCode = formData.get("planCode");

  if (isDemoUserEmail(user.email)) {
    redirect("/dashboard");
  }

  if (user.role !== "organization_owner" && user.role !== "super_admin") {
    redirect("/select-plan?error=owner-required");
  }

  if (!isRewaqPlanCode(planCode)) {
    redirect("/select-plan?error=invalid-plan");
  }

  if (!hasSupabaseAdminEnv()) {
    redirect("/select-plan?error=service-unavailable");
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("select_trial_plan_atomic", {
    p_organization_id: user.organizationId,
    p_plan_code: planCode,
    p_actor_user_id: user.id,
  });

  if (error) {
    console.error("[select-plan]", error.message);
    redirect("/select-plan?error=save-failed");
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/billing");
  redirect("/dashboard");
}
