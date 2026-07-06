import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getAccountingSettingsData } from "@/server/queries/accounting-erp";
import { SettingsClient } from "@/components/accounting/settings-client";

export default async function SettingsPage() {
  const session = await getCurrentSession();

  // Allow ONLY super_admin and organization_owner
  if (!["super_admin", "organization_owner"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const initialSettings = await getAccountingSettingsData();

  return (
    <>
      <PageHeader
        title="إعدادات المحاسبة العامة والتحكم"
        description="إدارة إعدادات العملة، الضرائب، الترحيل المزدوج، وصلاحيات الفروع ومراكز التكلفة وقواعد البيع بالسالب."
      />
      <div className="mt-4">
        <SettingsClient initialSettings={initialSettings} />
      </div>
    </>
  );
}
