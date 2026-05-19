import { KeyRound, Link2, Plus, Workflow } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getNodeRedSocialPublishingStatus } from "@/lib/social/node-red";
import { getSocialPlatformLabel } from "@/lib/social/platforms";
import { getMarketingData } from "@/server/queries/app";

export default async function SocialAccountsPage() {
  const { accounts } = await getMarketingData();
  const nodeRedStatus = getNodeRedSocialPublishingStatus();

  return (
    <>
      <PageHeader
        title="الحسابات الاجتماعية"
        description="ربط صفحات فيسبوك وحسابات إنستغرام للأعمال وقنوات تلغرام. لا تخزن مفاتيح الربط كنص عادي في الإنتاج."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            ربط حساب
          </Button>
        }
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-primary">
                <Workflow className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Node-RED social webhook</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {nodeRedStatus.configured ? "جاهز لاستقبال المنشورات من المنصة." : "اضبط NODE_RED_SOCIAL_PUBLISH_WEBHOOK_URL للتشغيل الحقيقي."}
                </p>
              </div>
            </div>
            <Badge tone={nodeRedStatus.configured ? "success" : "warning"}>
              {nodeRedStatus.configured ? "متصل" : "غير مضبوط"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-accent">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">API داخلي</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">/api/node-red/social-publish</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            الحسابات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنصة</TableHead>
                <TableHead>الحساب</TableHead>
                <TableHead>آخر نشر</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{getSocialPlatformLabel(account.platform)}</TableCell>
                  <TableCell className="font-medium">{account.accountName}</TableCell>
                  <TableCell>
                    {account.lastPublishedAt ? new Date(account.lastPublishedAt).toLocaleString("ar-PS") : "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={account.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
