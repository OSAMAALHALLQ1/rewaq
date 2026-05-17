import { ShieldCheck } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminData } from "@/server/queries/app";

export default async function AdminDashboardPage() {
  const { metrics, logs, tickets } = await getAdminData();

  return (
    <>
      <PageHeader
        title="لوحة الأدمن"
        description="إدارة العملاء، الاشتراكات، مفاتيح الميزات، السجلات، وتذاكر الدعم عبر المنصة."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            description={metric.delta}
            tone={metric.tone}
            icon={ShieldCheck}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>سجلات النظام</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستوى</TableHead>
                  <TableHead>الرسالة</TableHead>
                  <TableHead>الوقت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <StatusBadge status={log.level} />
                    </TableCell>
                    <TableCell>{log.message}</TableCell>
                    <TableCell>{log.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>تذاكر الدعم</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التذكرة</TableHead>
                  <TableHead>المؤسسة</TableHead>
                  <TableHead>الموضوع</TableHead>
                  <TableHead>الأولوية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-semibold">{ticket.id}</TableCell>
                    <TableCell>{ticket.organization}</TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.priority} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
