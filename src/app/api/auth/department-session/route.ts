import { NextResponse } from "next/server";
import { authenticateDepartmentDevice, employeeRoleAllowsModule } from "@/lib/department/auth";

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    success: true,
    organizationId: auth.device.organizationId,
    branchId: auth.device.branchId,
    role: auth.device.role,
    allowedModules: auth.device.allowedModules.filter((module) =>
      employeeRoleAllowsModule(auth.actor.role, module),
    ),
    deviceName: auth.device.deviceName,
    employeeName: auth.actor.name,
    employeeRole: auth.actor.role,
    employeeDepartmentId: auth.actor.departmentId,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("rwq_dept_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
