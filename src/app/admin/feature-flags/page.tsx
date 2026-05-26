import { ToggleLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminData } from "@/server/queries/app";

export default async function FeatureFlagsPage() {
  const { flags } = await getAdminData();

  return (
    <>
      <PageHeader title="مفاتيح الميزات" description="تفعيل وإيقاف الميزات التجريبية لكل المنصة أو لكل عميل لاحقًا." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleLeft className="h-5 w-5 text-primary" />
            المفاتيح
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {flags.map((flag: any) => (
            <div key={flag.key} className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="font-mono text-sm font-semibold">{flag.key}</p>
                <p className="mt-1 text-sm text-muted-foreground">{flag.description}</p>
              </div>
              <Badge tone={flag.enabled ? "success" : "muted"}>{flag.enabled ? "مفعل" : "متوقف"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
