import { PageShellClient } from "@/components/layout/page-shell";
import { requireAdminSession } from "@/lib/auth/admin-session";
import type { AppSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminSession = await requireAdminSession();

  const sessionMock: AppSession = {
    user: {
      id: `platform:${adminSession.username}`,
      email: "",
      name: adminSession.username,
    },
    organizationId: "rewaq-platform",
    organizationName: "إدارة منصة رواق",
    role: "super_admin",
  };

  return (
    <PageShellClient
      session={sessionMock}
      notifications={[]}
      mode="admin"
    >
      {children}
    </PageShellClient>
  );
}
