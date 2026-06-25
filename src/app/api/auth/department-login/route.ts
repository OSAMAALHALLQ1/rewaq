import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    const normalizedKey = typeof apiKey === "string" ? apiKey.trim().toUpperCase() : "";

    if (!normalizedKey || normalizedKey.length !== 10) {
      return NextResponse.json(
        { success: false, error: "كود غير صالح. يجب أن يتكون الكود من 10 رموز." },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Demo/Simulation mode bypass!
      return NextResponse.json({
        success: true,
        token: normalizedKey,
        organizationId: "00000000-0000-4000-8000-000000000001",
        branchId: "00000000-0000-4000-8000-000000000101",
        role: "cashier",
        allowedModules: ["pos", "inventory", "recipes", "waste"],
        deviceName: "جهاز كاشير تجريبي",
      });
    }

    // 1. Hash the key using SHA-256 for secure database lookup
    const keyHash = createHash("sha256").update(normalizedKey).digest("hex");

    // 2. Query the department key in Supabase
    const supabaseAdmin = getSupabaseAdmin();
    const { data: keyData, error: keyError } = await (supabaseAdmin as any)
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

    if (keyError || !keyData) {
      return NextResponse.json(
        { success: false, error: "رمز الوصول هذا غير موجود بقاعدة البيانات." },
        { status: 401 }
      );
    }

    if (!keyData.is_active) {
      return NextResponse.json(
        { success: false, error: "تم إلغاء تنشيط هذا الجهاز من قبل مدير المطعم." },
        { status: 403 }
      );
    }

    // 3. Update last used timestamp
    await (supabaseAdmin as any)
      .from("department_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyData.id);

    // 4. Return successful metadata to the client
    return NextResponse.json({
      success: true,
      token: normalizedKey, // The raw key acts as a client-side session token
      organizationId: keyData.organization_id,
      branchId: keyData.branch_id,
      role: keyData.role,
      allowedModules: keyData.allowed_modules,
      deviceName: keyData.device_name,
    });
  } catch (err: any) {
    console.error("Department login error:", err);
    return NextResponse.json(
      { success: false, error: "فشل التحقق من الكود بسبب مشكلة داخلية في الخادم." },
      { status: 500 }
    );
  }
}
