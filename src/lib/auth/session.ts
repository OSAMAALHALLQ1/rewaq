import "server-only";
import { redirect } from "next/navigation";
import { demoBranches, demoOrganization } from "@/lib/demo-data";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/domain";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  organizationId: string;
  organizationName: string;
  branchId?: string;
  branchName?: string;
  role: Role;
  isDemo: boolean;
};

export async function getCurrentSession(): Promise<AppSession> {
  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      const subject = data?.claims?.sub;

      if (subject) {
        return {
          user: {
            id: subject,
            email: String(data.claims.email ?? "owner@rewaq.app"),
            name: String(data.claims.user_metadata?.name ?? "مالك المطعم"),
          },
          organizationId: demoOrganization.id,
          organizationName: demoOrganization.name,
          branchId: demoBranches[0].id,
          branchName: demoBranches[0].name,
          role: "organization_owner",
          isDemo: false,
        };
      }
    } catch {
      // Fall through to demo mode so local UI stays usable without Supabase.
    }

    if (process.env.NODE_ENV === "production") {
      redirect("/login");
    }
  }

  return {
    user: {
      id: "demo-user",
      email: "owner@rewaq.app",
      name: "مالك مطعم إيوان",
    },
    organizationId: demoOrganization.id,
    organizationName: demoOrganization.name,
    branchId: demoBranches[0].id,
    branchName: demoBranches[0].name,
    role: "organization_owner",
    isDemo: true,
  };
}
