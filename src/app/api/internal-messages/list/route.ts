import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDepartmentDevice } from "@/lib/department/auth";
import { getOptionalSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const departmentKey = request.headers.get("x-department-key") || request.headers.get("x-api-key");
    const auth = departmentKey ? await authenticateDepartmentDevice(request) : null;
    const session = auth?.ok ? null : await getOptionalSession();
    const organizationId = auth?.ok ? auth.device.organizationId : session?.organizationId;
    const branchId = auth?.ok ? auth.device.branchId : session?.branchId;
    const role = auth?.ok ? auth.device.role : session?.role;
    const userId = auth?.ok ? null : session?.user.id;

    if (!organizationId || !role) {
      return NextResponse.json(
        { success: false, error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const before = url.searchParams.get("before"); // cursor pagination by created_at

    const admin = auth?.ok ? auth.admin : createAdminClient();
    let query = (admin as any)
      .from("internal_messages")
      .select("id, organization_id, branch_id, sender_id, sender_name, sender_role, recipient_role, content, created_at, read_at")
      .eq("organization_id", organizationId);

    // Owners/managers see all messages; staff see messages relevant to them
    if (role !== "organization_owner" && role !== "super_admin" && role !== "branch_manager") {
      const roleFilter = userId
        ? `recipient_role.is.null,sender_id.eq.${userId},recipient_role.eq.${role}`
        : `recipient_role.is.null,recipient_role.eq.${role}`;
      query = query.or(roleFilter);
    }

    if (branchId) {
      query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    }

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: messages, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error listing messages:", error);
      return NextResponse.json(
        { success: false, error: "فشل استرجاع الرسائل." },
        { status: 500 }
      );
    }

    const hasMore = messages.length === limit;
    const nextCursor = hasMore && messages.length > 0
      ? messages[messages.length - 1].created_at
      : null;

    return NextResponse.json({
      success: true,
      messages: [...(messages ?? [])].reverse(),
      pagination: { nextCursor, hasMore },
    });
  } catch (err: any) {
    console.error("Message fetch error:", err);
    return NextResponse.json(
      { success: false, error: "فشل استرجاع الرسائل بسبب مشكلة داخلية." },
      { status: 500 }
    );
  }
}
