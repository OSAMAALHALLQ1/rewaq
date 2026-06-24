"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  LogOut,
  MessageSquare,
  PackageCheck,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InternalChatDrawer } from "@/components/layout/internal-chat-drawer";

type DeviceSession = {
  token: string;
  name: string;
  orgId: string;
  branchId: string;
  role: string;
};

type StockItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minimum: number;
  status: "ok" | "low";
};

const stockItems: StockItem[] = [
  { id: "stock_1", name: "لحم برجر مبرد", unit: "كجم", quantity: 18, minimum: 12, status: "ok" },
  { id: "stock_2", name: "بطاطس مجمدة", unit: "كجم", quantity: 7, minimum: 10, status: "low" },
  { id: "stock_3", name: "خبز برجر", unit: "حبة", quantity: 96, minimum: 50, status: "ok" },
  { id: "stock_4", name: "صلصة خاصة", unit: "لتر", quantity: 4, minimum: 6, status: "low" },
];

export default function DepartmentInventoryPage() {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceSession>({ token: "", name: "", orgId: "", branchId: "", role: "" });
  const [authorized, setAuthorized] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("rwq_dept_key");
    const allowed = JSON.parse(localStorage.getItem("rwq_dept_allowed") || "[]") as string[];

    if (!token || !allowed.includes("inventory")) {
      router.push("/d/gate");
      return;
    }

    setDevice({
      token,
      name: localStorage.getItem("rwq_dept_device") ?? "",
      orgId: localStorage.getItem("rwq_dept_org_id") ?? "",
      branchId: localStorage.getItem("rwq_dept_branch_id") ?? "",
      role: localStorage.getItem("rwq_dept_role") ?? "",
    });
    setAuthorized(true);
  }, [router]);

  const filteredItems = useMemo(
    () => stockItems.filter((item) => item.name.includes(searchQuery.trim())),
    [searchQuery],
  );

  const handleLogout = () => {
    localStorage.removeItem("rwq_dept_key");
    localStorage.removeItem("rwq_dept_role");
    localStorage.removeItem("rwq_dept_org_id");
    localStorage.removeItem("rwq_dept_branch_id");
    localStorage.removeItem("rwq_dept_allowed");
    localStorage.removeItem("rwq_dept_device");
    document.cookie = "rwq_dept_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/d/gate");
  };

  if (!authorized) return null;

  const lowStockCount = stockItems.filter((item) => item.status === "low").length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl flex items-center justify-center">
            <Boxes className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="font-bold text-sm tracking-wide">شاشة المستودع والمخزون</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">الجهاز: {device.name} | وصول قسم موثق</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-100 flex items-center gap-2 text-xs h-10 px-4"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare className="h-4 w-4 text-teal-400" />
            <span>الدردشة الفورية</span>
          </Button>
          <Button
            variant="outline"
            className="border-slate-800 bg-slate-900/50 hover:bg-rose-950/30 hover:border-rose-900/50 text-rose-400 h-10 w-10 p-0"
            onClick={handleLogout}
            title="تسجيل الخروج وإلغاء الجهاز"
          >
            <LogOut className="h-4.5 w-4.5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 text-right">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold">إجمالي المواد</p>
                <p className="text-2xl font-black mt-1">{stockItems.length}</p>
              </div>
              <PackageCheck className="h-7 w-7 text-teal-400" />
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold">تحت الحد الأدنى</p>
                <p className="text-2xl font-black mt-1 text-amber-400">{lowStockCount}</p>
              </div>
              <ShieldAlert className="h-7 w-7 text-amber-400" />
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold">حالة الجلسة</p>
                <p className="text-sm font-black mt-2 text-emerald-400">نشطة</p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-teal-400" />
              جرد سريع للقسم
            </CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="بحث عن مادة"
                className="ps-9 h-9 bg-slate-950 border-slate-800 text-slate-100 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {filteredItems.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">{item.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1">الحد الأدنى: {item.minimum} {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-black">{item.quantity}</span>
                    <span className="text-xs text-slate-400">{item.unit}</span>
                    <Badge className={item.status === "low" ? "bg-amber-500 text-slate-950" : "bg-teal-500 text-slate-950"}>
                      {item.status === "low" ? "يحتاج طلب" : "مستقر"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <InternalChatDrawer
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        orgId={device.orgId}
        branchId={device.branchId}
        currentRole={device.role}
        currentName={device.name}
        departmentKey={device.token}
      />
    </div>
  );
}
