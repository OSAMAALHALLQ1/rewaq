import { PageShell } from "@/components/layout/page-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
