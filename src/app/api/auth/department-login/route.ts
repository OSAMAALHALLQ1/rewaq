import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { canUseDemoFallback, hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalSession } from "@/lib/auth/session";
import { departmentRoleAllowsModule, employeeRoleAllowsModule } from "@/lib/department/auth";

const INVALID_DEPARTMENT_CODE = "رمز الوصول غير صالح أو غير مفعل.";

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json().catch(() => ({ apiKey: null }));
    const normalizedKey = typeof apiKey === "string" ? apiKey.trim().toUpperCase() : "";

    if (!normalizedKey || normalizedKey.length !== 10) {
      return NextResponse.json(
        { success: false, error: "كود غير صالح. يجب أن يتكون الكود من 10 رموز." },
        { status: 400 }
      );
    }

    if (!hasSupabaseAdminEnv()) {
      if (!canUseDemoFallback()) {
        return NextResponse.json(
          {
            success: false,
            error: "إعدادات Supabase الإنتاجية غير مكتملة. تم إيقاف تسجيل دخول الأجهزة بدلاً من إنشاء جلسة تجريبية.",
          },
          { status: 503 },
        );
      }

      const response = NextResponse.json({
        success: true,
        organizationId: "00000000-0000-4000-8000-000000000001",
        branchId: "00000000-0000-4000-8000-000000000101",
        role: "manager",
        allowedModules: ["pos", "inventory", "recipes", "waste", "waiter", "kitchen", "expo"],
        deviceName: "جهاز كاشير تجريبي",
      });

      response.cookies.set("rwq_dept_token", normalizedKey, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 43200,
      });

      return response;
    }

    // 1. Hash the key using SHA-256 for secure database lookup
    const keyHash = createHash("sha256").update(normalizedKey).digest("hex");

    // 2. Query the department key in Supabase
    const supabaseAdmin = createAdminClient();
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from("department_api_keys")
      .select(`
        id,
        organization_id,
        branch_id,
        device_name,
        role,
        allowed_modules,
        is_active
      `)
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyData || !keyData.is_active) {
      return NextResponse.json(
        { success: false, error: INVALID_DEPARTMENT_CODE },
        { status: 401 }
      );
    }

    const allowedModules = Array.isArray(keyData.allowed_modules)
      ? keyData.allowed_modules.map(String)
      : [];
    if (
      allowedModules.length === 0 ||
      allowedModules.some(
        (module: string) => !departmentRoleAllowsModule(String(keyData.role), module),
      )
    ) {
      return NextResponse.json(
        { success: false, error: "صلاحيات هذا الجهاز غير متناسقة. راجع مالك المؤسسة." },
        { status: 403 }
      );
    }

    const employee = await getOptionalSession();
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "سجّل دخول الموظف بكوده الشخصي أولًا." },
        { status: 401 },
      );
    }
    if (employee.organizationId !== keyData.organization_id) {
      return NextResponse.json(
        { success: false, error: "الموظف والجهاز لا يتبعان نفس المؤسسة." },
        { status: 403 },
      );
    }
    if (employee.branchId && keyData.branch_id && employee.branchId !== keyData.branch_id) {
      return NextResponse.json(
        { success: false, error: "الموظف غير مخول للعمل على فرع هذا الجهاز." },
        { status: 403 },
      );
    }

    const employeeAllowedModules = allowedModules.filter((module: string) =>
      employeeRoleAllowsModule(employee.role, module),
    );
    if (employeeAllowedModules.length === 0) {
      return NextResponse.json(
        { success: false, error: "دور الموظف لا يطابق واجهة هذا الجهاز." },
        { status: 403 },
      );
    }

    // 3. Update last used timestamp and require an audit record before issuing
    // the cookie. A device login must never become an untracked privileged action.
    const [{ error: usageError }, { error: auditError }] = await Promise.all([
      supabaseAdmin
        .from("department_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyData.id),
      supabaseAdmin.from("audit_logs").insert({
        organization_id: keyData.organization_id,
        branch_id: keyData.branch_id,
        user_id: employee.user.id,
        action: "department_device_login",
        entity_type: "department_api_key",
        entity_id: keyData.id,
        old_data: null,
        new_data: {
          role: keyData.role,
          allowed_modules: employeeAllowedModules,
          device_name: keyData.device_name,
          employee_role: employee.role,
        },
      }),
    ]);

    if (usageError || auditError) {
      console.error(
        "[department-login-audit]",
        usageError?.message ?? auditError?.message,
      );
      return NextResponse.json(
        { success: false, error: "تعذر توثيق جلسة الجهاز بأمان." },
        { status: 503 },
      );
    }

    // 4. Return successful metadata to the client
    const response = NextResponse.json({
      success: true,
      organizationId: keyData.organization_id,
      branchId: keyData.branch_id,
      role: keyData.role,
      allowedModules: employeeAllowedModules,
      deviceName: keyData.device_name,
      employeeName: employee.user.name,
      employeeRole: employee.role,
    });

    response.cookies.set("rwq_dept_token", normalizedKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 43200, // 12 hours short TTL
    });

    return response;
  } catch (error: unknown) {
    console.error(
      "Department login error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { success: false, error: "فشل التحقق من الكود بسبب مشكلة داخلية في الخادم." },
      { status: 500 }
    );
  }
}
