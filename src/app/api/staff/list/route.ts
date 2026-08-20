import { NextResponse } from "next/server";

/** @deprecated Legacy staff rows are migrated to team_invites by migration 066. */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "هذه الواجهة القديمة متوقفة لأنها كانت تعرض أكوادًا مكشوفة. استخدم إدارة الفريق.",
      replacement: "/dashboard/settings/users",
    },
    { status: 410 },
  );
}
