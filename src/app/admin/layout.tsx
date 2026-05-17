import { PageShell } from "@/components/layout/page-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PageShell mode="admin">{children}</PageShell>;
}
