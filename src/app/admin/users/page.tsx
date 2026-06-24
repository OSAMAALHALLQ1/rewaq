import { CheckCircle2, Clock3, Mail, UserX, Users } from "lucide-react";
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
  pending_owner_approval: "بانتظار الموافقة",
  approved: "مقبول ومفعل",
  rejected: "مرفوض",
};

const statusTone = (status: string) => {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "danger" as const;
  return "warning" as const;
};

export default async function AdminUsersPage() {
  const requests = await getAccountApprovalRequests();
  const pendingRequests = requests.filter((request) => request.status.includes("pending"));
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const rejectedRequests = requests.filter((request) => request.status === "rejected");

  return (
    <>
      <PageHeader
        title="تفعيل حسابات المستخدمين"
        description="راجع طلبات الحسابات الجديدة، وافتح الدخول فقط بعد الموافقة اليدوية."
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
          <CardContent className="flex items-center gap-3 p-5">
            <Clock3 className="h-6 w-6 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">بانتظار الموافقة</p>
              <p className="text-2xl font-black">{pendingRequests.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">مقبولين</p>
              <p className="text-2xl font-black">{approvedRequests.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <UserX className="h-6 w-6 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">مرفوضين</p>
              <p className="text-2xl font-black">{rejectedRequests.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            الحسابات وطلبات التفعيل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    لا توجد طلبات حسابات حتى الآن.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request: any) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{request.ownerName}</p>
                        <p className="text-xs text-muted-foreground">{request.organizationName}</p>
                      </div>
                    </TableCell>
                    <TableCell>{request.email}</TableCell>
                    <TableCell>{request.phone || "غير مضاف"}</TableCell>
                    <TableCell>{new Date(request.requestedAt).toLocaleString("ar-PS")}</TableCell>
                    <TableCell>
                      <Badge tone={statusTone(request.status)}>{statusLabels[request.status] ?? request.status}</Badge>
                      {request.rejectionReason ? <p className="mt-1 text-xs text-destructive">{request.rejectionReason}</p> : null}
                    </TableCell>
                    <TableCell>
                      {request.status.includes("pending") ? (
                        <div className="grid min-w-52 gap-2">
                          <ActionForm action={approveAccountRequestAction} submitLabel="قبول الحساب" className="space-y-2">
                            <Input type="hidden" name="requestId" value={request.id} readOnly />
                          </ActionForm>
                          <ActionForm action={rejectAccountRequestAction} submitLabel="رفض الحساب" className="space-y-2">
                            <Input type="hidden" name="requestId" value={request.id} readOnly />
                            <div className="grid gap-1">
                              <Label htmlFor={`reason-${request.id}`} className="text-xs">
                                سبب الرفض
                              </Label>
                              <Textarea id={`reason-${request.id}`} name="reason" rows={2} placeholder="مثال: بيانات ناقصة" />
                            </div>
                          </ActionForm>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">تمت المعالجة</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5 text-sm leading-7 text-muted-foreground">
          المسار الآمن: المستخدم يسجل حسابًا جديدًا، ثم يصبح `pending` في `profiles`، ويصلك إشعار على البريد،
          وبعد القبول يصبح `approved` وتُنشأ المؤسسة والعضوية ورابط الدخول.
        </CardContent>
      </Card>
    </>
  );
}
