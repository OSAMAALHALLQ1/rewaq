import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/auth/admin-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const expectedUsername = process.env.INTERNAL_ADMIN_USERNAME;
    const expectedPassword = process.env.INTERNAL_ADMIN_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return NextResponse.json(
        { error: "Admin credentials not configured on the server" },
        { status: 500 }
      );
    }

    if (username === expectedUsername && password === expectedPassword) {
      await createAdminSession(username);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
