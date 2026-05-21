import { Clock3, Mail, ShieldCheck } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getRegistrationAdminEmail } from "@/lib/email/registration-notifications";
import { approveAccountRequestAction, rejectAccountRequestAction } from "@/server/actions/auth";
import { getAccountApprovalRequests } from "@/server/queries/app";

const statusLabels: Record<string, string> = {
  pending_email_verification: "بانتظار تفعيل البريد",
  pending_owner_approval: "بانتظار موافقتك",
  approved: "مقبول",
  rejected: "مرفوض",
};

const statusTone = (status: string) => {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "danger" as const;
  return "warning" as const;
};

export default async function AccountRequestsPage() {
  const requests = await getAccountApprovalRequests();
  const pendingCount = requests.filter((request) => request.status.includes("pending")).length;

  return (
    <>
      <PageHeader
        title="طلبات التسجيل والموافقة"
        description="أي صاحب عمل يسجل بالبريد يظهر هنا. توافق أو ترفض قبل أن يحصل على حسابه الكامل."
        actions={
          <Button asChild variant="outline">
            <a href={`mailto:${getRegistrationAdminEmail()}`}>
              <Mail className="h-4 w-4" />
              {getRegistrationAdminEmail()}
            </a>
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">طلبات بانتظارك</p>
            <p className="mt-2 text-3xl font-black text-primary">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">بريد الإشعارات</p>
            <p className="mt-2 font-bold">{getRegistrationAdminEmail()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">المسار</p>
            <p className="mt-2 font-bold">تسجيل → تفعيل بريد → موافقة أدمن → دخول</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة طلبات الحسابات</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المؤسسة</TableHead>
                <TableHead>المالك</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>النشاط</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-semibold">{request.organizationName}</TableCell>
                  <TableCell>
                    <div>
                      <p>{request.ownerName}</p>
                      <p className="text-xs text-muted-foreground">{request.phone || "بدون رقم"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{request.email}</p>
                      {request.organizationId ? (
                        <p className="text-xs text-muted-foreground">مربوط بمؤسسة</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <Badge tone={request.authUserId ? "success" : "warning"}>
                        {request.authUserId ? "موجود" : "غير مسجل"}
                      </Badge>
                      {request.authUserId ? (
                        <p className="text-xs text-muted-foreground">
                          {request.authEmailConfirmed ? "البريد مفعل" : "لم يفعل البريد"}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{request.businessType}</TableCell>
                  <TableCell>
                    <Badge tone={statusTone(request.status)}>{statusLabels[request.status] ?? request.status}</Badge>
                    {request.rejectionReason ? <p className="mt-1 text-xs text-destructive">{request.rejectionReason}</p> : null}
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-2">
                      <ActionForm action={approveAccountRequestAction} submitLabel="موافقة" className="space-y-2">
                        <Input type="hidden" name="requestId" value={request.id} readOnly />
                        <div className="rounded-lg bg-green-50 p-2 text-xs leading-5 text-green-700">
                          ينشئ مؤسسة وعضوية مالك ويربطها بحساب Auth.
                        </div>
                      </ActionForm>

                      <ActionForm action={rejectAccountRequestAction} submitLabel="رفض" className="space-y-2">
                        <Input type="hidden" name="requestId" value={request.id} readOnly />
                        <div className="grid gap-1">
                          <Label htmlFor={`reason-${request.id}`} className="text-xs">
                            سبب الرفض
                          </Label>
                          <Textarea id={`reason-${request.id}`} name="reason" rows={2} placeholder="مثال: بيانات ناقصة" />
                        </div>
                      </ActionForm>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex gap-3 p-5">
            <ShieldCheck className="mt-1 h-5 w-5 text-success" />
            <div>
              <h2 className="font-semibold">عند الموافقة</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                يتم ربط حساب Supabase Auth بالبريد، إنشاء المؤسسة والفرع الرئيسي، ثم إضافة صاحب الطلب كمالك مؤسسة.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex gap-3 p-5">
            <Clock3 className="mt-1 h-5 w-5 text-warning" />
            <div>
              <h2 className="font-semibold">قبل الموافقة</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                يجب أن يكون البريد موجودًا في Auth، لذلك يرسل صاحب الحساب نموذج التسجيل أولًا ثم يظهر هنا للمراجعة.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
