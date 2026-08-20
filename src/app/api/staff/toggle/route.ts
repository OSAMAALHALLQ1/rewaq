import { NextResponse } from "next/server";

/** @deprecated Access revocation now preserves identity and audit history. */
export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: "استخدم إدارة الفريق لإيقاف الموظف أو إصدار كود جديد مع سجل تدقيق.",
      replacement: "/dashboard/settings/users",
    },
    { status: 410 },
  );
}
