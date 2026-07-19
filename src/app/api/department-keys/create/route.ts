import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { ForbiddenError, requireSensitiveActionCapability } from "@/lib/auth/require-auth";
import { getOptionalSession } from "@/lib/auth/session";
import type { RewaqModule } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SubscriptionEntitlementError,
  requireOrganizationModule,
} from "@/server/billing/entitlements";

const allowedRoles = new Set(["chef", "cashier", "inventory_manager", "staff"]);
const allowedModuleKeys = new Set([
  "inventory",
  "recipes",
  "purchasing",
  "waste",
  "pos",
  "reports",
  "waiter",
  "kitchen",
  "expo",
]);
const workflowModuleKeys = new Set(["waiter", "kitchen", "expo"]);
const moduleEntitlements: Readonly<Record<string, RewaqModule>> = {
  inventory: "inventory",
  recipes: "recipes",
  purchasing: "purchasing",
  waste: "waste",
  pos: "pos",
  reports: "reports",
  waiter: "restaurant_workflow",
  kitchen: "restaurant_workflow",
  expo: "restaurant_workflow",
};
const roleModuleAllowlist: Readonly<Record<string, ReadonlySet<string>>> = {
  chef: new Set(["recipes", "inventory", "waste", "kitchen"]),
  cashier: new Set(["pos"]),
  inventory_manager: new Set(["inventory", "purchasing", "waste", "reports"]),
  staff: new Set(["inventory", "recipes", "waste", "pos", "waiter", "kitchen", "expo"]),
};

function generateRawKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let key = "RWQ_";
  for (let i = 0; i < 6; i++) key += chars[bytes[i] % chars.length];
  return key;
}

export async function POST(request: Request) {
  try {
    const session = await getOptionalSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "يجب تسجيل الدخول أولاً." }, { status: 401 });
    }
    if (!session.organizationId) {
      return NextResponse.json(
        { success: false, error: "حسابك غير مربوط بمؤسسة معتمدة." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const deviceName = typeof body.deviceName === "string" ? body.deviceName.trim() : "";
    const branchId = typeof body.branchId === "string" && body.branchId ? body.branchId : null;
    const role = typeof body.role === "string" ? body.role : "";
    const requestedModules = Array.isArray(body.allowedModules)
      ? [...new Set(body.allowedModules.filter((module): module is string => typeof module === "string"))]
      : [];

    if (!deviceName || deviceName.length > 120) {
      return NextResponse.json(
        { success: false, error: "اسم الجهاز مطلوب وبحد أقصى 120 حرفاً." },
        { status: 400 },
      );
    }
    if (!allowedRoles.has(role)) {
      return NextResponse.json({ success: false, error: "دور الجهاز غير صالح." }, { status: 400 });
    }

    const permittedForRole = roleModuleAllowlist[role];
    const normalizedModules = requestedModules.filter(
      (module) => allowedModuleKeys.has(module) && permittedForRole.has(module),
    );
    if (normalizedModules.length === 0 || normalizedModules.length !== requestedModules.length) {
      return NextResponse.json(
        { success: false, error: "اختر صلاحيات صالحة ومناسبة لدور الجهاز فقط." },
        { status: 400 },
      );
    }

    const isWorkflowDevice = normalizedModules.some((module) => workflowModuleKeys.has(module));
    if (isWorkflowDevice && normalizedModules.some((module) => !workflowModuleKeys.has(module))) {
      return NextResponse.json(
        { success: false, error: "أنشئ جهاز دورة المطعم مستقلاً عن أجهزة المخزون والكاشير." },
        { status: 400 },
      );
    }
    if (isWorkflowDevice && !branchId) {
      return NextResponse.json(
        { success: false, error: "يجب تحديد فرع لجهاز النادل أو المطبخ أو Expo." },
        { status: 400 },
      );
    }

    try {
      requireSensitiveActionCapability(session, "device_write", branchId);
    } catch (error) {
      const message =
        error instanceof ForbiddenError
          ? error.message
          : "فقط مالك المؤسسة أو المسؤول المخول يستطيع إنشاء أجهزة جديدة.";
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }

    const admin = createAdminClient();
    const requiredModules = [...new Set(normalizedModules.map((module) => moduleEntitlements[module]))];
    let entitlements;
    try {
      for (const requiredModule of requiredModules) {
        entitlements = await requireOrganizationModule(
          admin,
          session.organizationId,
          requiredModule,
          { write: true },
        );
      }
    } catch (error) {
      if (error instanceof SubscriptionEntitlementError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 403 });
      }
      console.error("Department device entitlement verification failed:", error);
      return NextResponse.json(
        { success: false, error: "تعذر التحقق من باقة المؤسسة؛ لم يتم إنشاء الجهاز." },
        { status: 503 },
      );
    }

    if (!entitlements) {
      return NextResponse.json(
        { success: false, error: "تعذر تحديد حدود الباقة؛ لم يتم إنشاء الجهاز." },
        { status: 503 },
      );
    }

    const { count: activeDeviceCount, error: countError } = await (admin as any)
      .from("department_api_keys")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", session.organizationId)
      .eq("is_active", true);
    if (countError) {
      return NextResponse.json(
        { success: false, error: "تعذر التحقق من حد أجهزة الباقة؛ لم يتم إنشاء الجهاز." },
        { status: 503 },
      );
    }
    if (
      entitlements.limits.maxDevices !== null &&
      (activeDeviceCount ?? 0) >= entitlements.limits.maxDevices
    ) {
      return NextResponse.json(
        { success: false, error: `وصلت إلى حد ${entitlements.limits.maxDevices} أجهزة في باقتك الحالية.` },
        { status: 409 },
      );
    }

    if (branchId) {
      const { data: branch, error: branchError } = await (admin as any)
        .from("branches")
        .select("id")
        .eq("id", branchId)
        .eq("organization_id", session.organizationId)
        .maybeSingle();
      if (branchError) {
        return NextResponse.json({ success: false, error: "تعذر التحقق من الفرع." }, { status: 500 });
      }
      if (!branch) {
        return NextResponse.json(
          { success: false, error: "الفرع المحدد غير موجود داخل مؤسستك." },
          { status: 400 },
        );
      }
    }

    const rawKey = generateRawKey();
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    let keyId: string;
    let createdDeviceName: string;

    if (isWorkflowDevice) {
      const { data, error } = await (admin as any).rpc(
        "provision_restaurant_workflow_device_atomic",
        {
          p_organization_id: session.organizationId,
          p_branch_id: branchId,
          p_device_name: deviceName,
          p_key_hash: keyHash,
          p_role: role,
          p_allowed_modules: normalizedModules,
          p_actor_user_id: session.user.id,
        },
      );
      const device = data?.device as { id?: string; device_name?: string } | undefined;
      if (error || !device?.id || !device.device_name) {
        console.error("Restaurant workflow device provisioning failed:", error);
        return NextResponse.json(
          { success: false, error: "فشل إنشاء جهاز دورة المطعم وربطه بالمحطة." },
          { status: 500 },
        );
      }
      keyId = device.id;
      createdDeviceName = device.device_name;
    } else {
      const { data, error } = await (admin as any)
        .from("department_api_keys")
        .insert({
          organization_id: session.organizationId,
          branch_id: branchId,
          device_name: deviceName,
          key_hash: keyHash,
          role,
          allowed_modules: normalizedModules,
          created_by: session.user.id,
        })
        .select("id, device_name")
        .single();
      if (error || !data) {
        console.error("Error creating department key:", error);
        return NextResponse.json({ success: false, error: "فشل إنشاء مفتاح الوصول." }, { status: 500 });
      }
      keyId = data.id;
      createdDeviceName = data.device_name;
    }

    return NextResponse.json({
      success: true,
      key: rawKey,
      keyId,
      deviceName: createdDeviceName,
    });
  } catch (error) {
    console.error("Department key creation error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إنشاء مفتاح الوصول بسبب مشكلة داخلية." },
      { status: 500 },
    );
  }
}
