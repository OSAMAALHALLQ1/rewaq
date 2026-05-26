import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function authenticateDepartmentApiKey(request: Request) {
  try {
    const key =
      request.headers.get("x-department-key") || request.headers.get("x-api-key");

    if (!key) {
      return NextResponse.json({ error: "Missing department API key" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("department_api_keys")
      .select("id, department_id, disabled, name")
      .eq("key", key)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!data || data.disabled) {
      return NextResponse.json({ error: "Invalid or disabled API key" }, { status: 401 });
    }

    // return minimal context for handlers
    return { departmentId: data.department_id, apiKeyId: data.id, apiKeyName: data.name };
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export function requireDepartmentApiKeyResult(result: any) {
  if (result instanceof NextResponse) return result;
  return null;
}
