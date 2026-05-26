import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const session = await getOptionalSession();
    if (!session || !session.organizationId) {
      return NextResponse.json(
        { success: false, error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const admin = createAdminClient();
    let query = admin
      .from("department_api_keys")
      .select(`
        id,
        organization_id,
        branch_id,
        device_name,
        role,
        allowed_modules,
        is_active,
        last_used_at,
        created_at,
        updated_at,
        created_by
      `)
      .eq("organization_id", session.organizationId);

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: keys, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing department keys:", error);
      return NextResponse.json(
        { success: false, error: "فشل استرجاع قائمة المفاتيح." },
        { status: 500 }
      );
    }

    // Fetch branch names for keys that have branch_id
    const branchIds = [...new Set(keys.filter((k) => k.branch_id).map((k) => k.branch_id!))];
    let branchMap: Record<string, string> = {};
    if (branchIds.length > 0) {
      const { data: branches } = await admin
        .from("branches")
        .select("id, name")
        .in("id", branchIds);
      if (branches) {
        for (const b of branches) {
          branchMap[b.id] = b.name;
        }
      }
    }

    const enriched = keys.map((key) => ({
      ...key,
      branch_name: key.branch_id ? branchMap[key.branch_id] || null : null,
    }));

    return NextResponse.json({ success: true, keys: enriched });
  } catch (err: any) {
    console.error("Department key fetch error:", err);
    return NextResponse.json(
      { success: false, error: "فشل استرجاع المفاتيح." },
      { status: 500 }
    );
  }
}
