import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/types/domain";

const statusMap: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "نشط", tone: "success" },
  inactive: { label: "متوقف", tone: "muted" },
  trial: { label: "تجريبي", tone: "warning" },
  draft: { label: "مسودة", tone: "muted" },
  sent: { label: "مرسل", tone: "default" },
  received: { label: "مستلم", tone: "success" },
  partially_received: { label: "استلام جزئي", tone: "warning" },
  cancelled: { label: "ملغي", tone: "danger" },
  paid: { label: "مدفوع", tone: "success" },
  issued: { label: "صادر", tone: "default" },
  void: { label: "ملغي", tone: "danger" },
  matched: { label: "مطابق", tone: "success" },
  flagged: { label: "بحاجة مراجعة", tone: "danger" },
  scheduled: { label: "مجدول", tone: "warning" },
  publishing: { label: "قيد النشر", tone: "default" },
  published: { label: "منشور", tone: "success" },
  queued: { label: "في الطابور", tone: "default" },
  failed: { label: "فشل", tone: "danger" },
  pending: { label: "بانتظار", tone: "warning" },
  connected: { label: "مرتبط", tone: "success" },
  expired: { label: "منتهي", tone: "danger" },
  disabled: { label: "معطل", tone: "muted" },
  open: { label: "مفتوح", tone: "warning" },
  normal: { label: "عادي", tone: "muted" },
  high: { label: "عالي", tone: "danger" },
  info: { label: "معلومة", tone: "default" },
  error: { label: "خطأ", tone: "danger" },
  warning: { label: "تحذير", tone: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusMap[status] ?? { label: status, tone: "muted" as StatusTone };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
