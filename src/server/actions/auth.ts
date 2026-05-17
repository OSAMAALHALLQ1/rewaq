"use server";

import { redirect } from "next/navigation";
import { authSchema, registerSchema } from "@/lib/validation/schemas";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  ok: boolean;
  message: string;
};

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "تحقق من البيانات" };
  }

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      return { ok: false, message: error.message };
    }
  }

  redirect("/dashboard");
}

export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    organizationName: formData.get("organizationName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "تحقق من البيانات" };
  }

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          name: parsed.data.name,
          organization_name: parsed.data.organizationName,
        },
      },
    });
    if (error) {
      return { ok: false, message: error.message };
    }
  }

  redirect("/dashboard");
}

export async function forgotPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = authSchema.pick({ email: true }).safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "أدخل البريد الإلكتروني" };
  }

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email);
  }

  return { ok: true, message: "إذا كان البريد مسجلًا، ستصلك رسالة استعادة كلمة المرور." };
}

export async function logoutAction() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
