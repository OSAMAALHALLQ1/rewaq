import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { getOptionalSession } from "@/lib/auth/session";

// Demo seed staff members (Tekka-style: avatar initial + role color + login code).
// Used when Supabase admin env is not configured (simulation mode).
const demoStaff = [
  { id: "staff-demo-1", full_name: "سامي الخطيب", phone: "0599123456", role: "waiter", login_code: "W-7392", is_active: true, created_at: new Date().toISOString(), branch_name: "فرع شارع عبد القادر الحسيني", linked_device_key_id: null },
  { id: "staff-demo-2", full_name: "ليان مرعي", phone: "0599654321", role: "waiter", login_code: "W-4815", is_active: true, created_at: new Date().toISOString(), branch_name: "فرع شارع عبد القادر الحسيني", linked_device_key_id: null },
  { id: "staff-demo-3", full_name: "أحمد الكاشير", phone: "0567112233", role: "cashier", login_code: "C-2046", is_active: true, created_at: new Date().toISOString(), branch_name: "فرع شارع عبد القادر الحسيني", linked_device_key_id: null },
  { id: "staff-demo-4", full_name: "الشيف خالد", phone: "0599009988", role: "kitchen", login_code: "K-9123", is_active: true, created_at: new Date().toISOString(), branch_name: "فرع شارع عبد القادر الحسيني", linked_device_key_id: null },
  { id: "staff-demo-5", full_name: "محمود بار", phone: "0567556677", role: "bar", login_code: "B-3378", is_active: false, created_at: new Date().toISOString(), branch_name: "فرع الرمال", linked_device_key_id: null },
];

export async function GET(request: Request) {
  const session = await getOptionalSession();
  if (!session || !session.organizationId) {
    return NextResponse.json({ success: false, error: "يجب تسجيل الدخول أولاً." }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ success: true, staff: demoStaff });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId") || session.organizationId;

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("staff_members")
    .select("id, full_name, phone, role, login_code, is_active, created_at, linked_device_key_id, branches(name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const staff = (data ?? []).map((row: any) => ({
    id: row.id,
    full_name: row.full_name,
    phone: row.phone ?? "",
    role: row.role,
    login_code: row.login_code,
    is_active: row.is_active,
    created_at: row.created_at,
    branch_name: row.branches?.name ?? "فرع غير محدد",
    linked_device_key_id: row.linked_device_key_id ?? null,
  }));

  return NextResponse.json({ success: true, staff });
}
