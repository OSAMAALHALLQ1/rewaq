import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDepartmentDevice } from "@/lib/department/auth";
import { getOptionalSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const departmentKey = request.headers.get("x-department-key") || request.headers.get("x-api-key");
    const auth = departmentKey ? await authenticateDepartmentDevice(request) : null;
    const session = auth?.ok ? null : await getOptionalSession();
    const organizationId = auth?.ok ? auth.device.organizationId : session?.organizationId;
    const sessionBranchId = auth?.ok ? auth.device.branchId : session?.branchId;
    const role = auth?.ok ? auth.device.role : session?.role;
    const senderId = auth?.ok ? null : session?.user.id;
    const senderName = auth?.ok ? auth.device.deviceName : session?.user.name;

    if (!organizationId || !role || !senderName) {
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

    const admin = auth?.ok ? auth.admin : createAdminClient();
    const { data, error } = await (admin as any)
      .from("internal_messages")
      .insert({
        organization_id: organizationId,
        branch_id: branchId || sessionBranchId || null,
        sender_id: senderId,
        sender_name: senderName,
        sender_role: role,
        recipient_role: recipientRole || null,
        content,
      })
      .select("id, organization_id, branch_id, sender_id, content, created_at, sender_name, sender_role, recipient_role")
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
