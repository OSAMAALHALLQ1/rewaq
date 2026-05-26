import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const session = await getOptionalSession();
    if (!session || !session.organizationId) {
      return NextResponse.json(
        { success: false, error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, recipientRole, branchId } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { success: false, error: "محتوى الرسالة مطلوب." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await (admin as any)
      .from("internal_messages")
      .insert({
        organization_id: session.organizationId,
        branch_id: branchId || session.branchId || null,
        sender_id: session.user.id,
        sender_name: session.user.name,
        sender_role: session.role as any,
        recipient_role: recipientRole || null,
        content,
      })
      .select("id, content, created_at, sender_name, sender_role, recipient_role")
      .single();

    if (error) {
      console.error("Error sending message:", error);
      return NextResponse.json(
        { success: false, error: "فشل إرسال الرسالة." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: data });
  } catch (err: any) {
    console.error("Message send error:", err);
    return NextResponse.json(
      { success: false, error: "فشل إرسال الرسالة بسبب مشكلة داخلية." },
      { status: 500 }
    );
  }
}
