import Link from "next/link";
import { Clock3, ExternalLink, ShieldCheck, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DirectDebitPage() {
  return (
    <>
      <PageHeader
        title="الخصم المباشر"
        description="الوحدة محفوظة لمرحلة التكامل مع مزود دفع أو بنك يدعم التفويضات المتكررة."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/bill-payments">
              <WalletCards className="h-4 w-4" />
              سداد فواتير الموردين
            </Link>
          </Button>
        }
      />

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-950">
            <Clock3 className="h-5 w-5" />
            مؤجلة حتى اختيار مزود
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-amber-950">
          <p>
            لا توجد أزرار إنشاء أو تعديل وهمية هنا. تفعيل الخصم المباشر يحتاج مزودًا رسميًا،
            تفويضًا موثقًا من العميل، webhooks موقعة، ومعالجة idempotent لكل محاولة خصم.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Requirement title="مزود الدفع" body="اسم البنك أو البوابة التي تدعم recurring mandates في بلد التشغيل." />
            <Requirement title="بيئة اختبار" body="API keys وwebhook secret لحساب sandbox قبل أي تشغيل حقيقي." />
            <Requirement title="سياسة محاسبية" body="حساب التسوية، رسوم المزود، الفشل، الاسترداد، والمطابقة البنكية." />
          </div>
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            لن يخزن رواق أرقام بطاقات أو حسابات كاملة؛ التكامل المستقبلي سيستخدم tokenization لدى المزود.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/accounting/receivables">
              الذمم المدينة الحالية
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function Requirement({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4">
      <p className="font-black">{title}</p>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}
