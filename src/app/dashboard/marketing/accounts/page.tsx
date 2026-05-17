import { Link2, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMarketingData } from "@/server/queries/app";

export default async function SocialAccountsPage() {
  const { accounts } = await getMarketingData();

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
                  <TableCell>{account.platform}</TableCell>
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
