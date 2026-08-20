import { NextResponse } from "next/server";

/** @deprecated Employee credentials are managed by the audited team-access actions. */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "تم توحيد أكواد الموظفين. استخدم صفحة المستخدمين والفريق لإصدار كود شخصي آمن.",
      replacement: "/dashboard/settings/users",
    },
    { status: 410 },
  );
}
