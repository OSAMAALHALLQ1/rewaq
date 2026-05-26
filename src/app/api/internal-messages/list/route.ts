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
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const before = url.searchParams.get("before"); // cursor pagination by created_at

    const admin = createAdminClient();
    let query = (admin as any)
      .from("internal_messages")
      .select("id, organization_id, branch_id, sender_id, sender_name, sender_role, recipient_role, content, created_at, read_at")
      .eq("organization_id", session.organizationId);

    // Owners/managers see all messages; staff see messages relevant to them
    if (session.role !== "organization_owner" && session.role !== "super_admin" && session.role !== "branch_manager") {
      query = query.or(
        `recipient_role.is.null,sender_id.eq.${session.user.id},recipient_role.eq.${session.role}`
      );
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
      messages,
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
