import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="الفوترة والاشتراك"
        description="صفحة تمهيدية جاهزة لربط مزود دفع محلي لاحقًا."
        actions={<Button variant="outline">تحديث البطاقة</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              الاشتراك الحالي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-semibold">النمو</p>
                <p className="text-sm text-muted-foreground">حتى 5 فروع مع التسويق والوصفات.</p>
              </div>
              <Badge tone="warning">تجريبي</Badge>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              لاحقًا: فوترة متقدمة، فواتير مطبوعة، ربط تلقائي مع مزود الدفع، وإدارة حدود الاستخدام.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الفاتورة القادمة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">₪249</p>
            <p className="mt-2 text-sm text-muted-foreground">بعد انتهاء الفترة التجريبية.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
