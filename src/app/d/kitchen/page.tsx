"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ChefHat, CookingPot, MessageSquare, LogOut, Clock, CheckCircle2, 
  Search, ShieldAlert, Sparkles, BookOpen, AlertTriangle, Scale 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InternalChatDrawer } from "@/components/layout/internal-chat-drawer";
import { createClient } from "@/lib/supabase/client";

type OrderItem = {
  name: string;
  qty: number;
};

type Order = {
  id: string;
  invoice_number: string;
  customer_name: string;
  table_number?: string;
  items: OrderItem[];
  status: "pending" | "preparing" | "ready";
  minutes: number;
  notes?: string;
};

export default function KitchenKDSWorkspace() {
  const router = useRouter();
  const [device, setDevice] = useState<any>({ name: "", orgId: "", branchId: "", role: "" });
  const [authorized, setAuthorized] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchRecipe, setSearchRecipe] = useState("");
  const supabase = createClient();

  // Mock recipe database matching seed structure
  const recipes = [
    { name: "برجر كلاسيك", cost: "8.50 ر.س", costPct: "28%", prep: "شواء اللحم 4 دقائق، إضافة الجبن والصلصة الخاصة في خبز البرجر." },
    { name: "برجر حار دبل", cost: "14.20 ر.س", costPct: "32%", prep: "شواء قطعتين لحم، دهن صلصة هالبينو حارة وإضافة رقائق شيبس مقرمش." },
    { name: "بطاطا مقلية عائلية", cost: "3.10 ر.س", costPct: "15%", prep: "قلي البطاطا 3 دقائق، رش بهار الملح المقرمش والبابريكا." },
    { name: "أرز بخاري لحم", cost: "19.80 ر.س", costPct: "35%", prep: "طهي الأرز مع الجزر والزبيب، وضع قطعة اللحم المحمرة بالقمة." },
  ];

  useEffect(() => {
    // 1. Check local session enrollment
    const token = localStorage.getItem("rwq_dept_key");
    const role = localStorage.getItem("rwq_dept_role");
    const allowed = JSON.parse(localStorage.getItem("rwq_dept_allowed") || "[]");

    if (!token || !allowed.includes("recipes")) {
      // Redirect to gate if session is missing or unauthorized
      router.push("/d/gate");
      return;
    }

    setDevice({
      token,
      role,
      orgId: localStorage.getItem("rwq_dept_org_id"),
      branchId: localStorage.getItem("rwq_dept_branch_id"),
      name: localStorage.getItem("rwq_dept_device"),
    });
    setAuthorized(true);

    // Seed mock active orders queue
    setOrders([
      {
        id: "ord_1",
        invoice_number: "INV-1090",
        customer_name: "عبد الله المالكي",
        table_number: "طاولة 4",
        items: [{ name: "برجر كلاسيك", qty: 2 }, { name: "بطاطا مقلية عائلية", qty: 1 }],
        status: "pending",
        minutes: 3,
        notes: "بدون مايونيز في البرجر الأول",
      },
      {
        id: "ord_2",
        invoice_number: "INV-1091",
        customer_name: "سارة الغامدي",
        table_number: "طلب خارجي (دليفري)",
        items: [{ name: "برجر حار دبل", qty: 1 }, { name: "بطاطا مقلية عائلية", qty: 1 }],
        status: "preparing",
        minutes: 8,
      },
      {
        id: "ord_3",
        invoice_number: "INV-1092",
        customer_name: "خالد الحربي",
        table_number: "طاولة 9",
        items: [{ name: "أرز بخاري لحم", qty: 1 }],
        status: "pending",
        minutes: 1,
      }
    ]);
  }, [router]);

  const updateOrderStatus = (id: string, nextStatus: "preparing" | "ready") => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === id ? { ...ord, status: nextStatus } : ord))
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("rwq_dept_key");
    localStorage.removeItem("rwq_dept_role");
    localStorage.removeItem("rwq_dept_org_id");
    localStorage.removeItem("rwq_dept_branch_id");
    localStorage.removeItem("rwq_dept_allowed");
    localStorage.removeItem("rwq_dept_device");
    
    // Clear cookies
    document.cookie = "rwq_dept_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    
    router.push("/d/gate");
  };

  if (!authorized) return null;

  const filteredRecipes = recipes.filter(r => r.name.includes(searchRecipe));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      
      {/* Immersive Dark KDS Header */}
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl flex items-center justify-center">
            <ChefHat className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="font-bold text-sm tracking-wide">شاشة المطبخ الفورية (KDS)</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">الجهاز: {device.name} | الفرع الموثق</p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-100 flex items-center gap-2 text-xs h-10 px-4"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare className="h-4 w-4 text-teal-400" />
            <span>الدردشة الفورية</span>
            <Badge tone="default" className="bg-teal-500 text-slate-950 text-[10px] font-bold">نشط</Badge>
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

      {/* Workspace Body Grid */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_380px] overflow-hidden">
        
        {/* Left Side: Dynamic KDS active order list */}
        <div className="p-6 overflow-y-auto space-y-6 text-right">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <CookingPot className="h-5 w-5 text-teal-400" />
              طلبات التحضير النشطة ({orders.filter(o => o.status !== "ready").length})
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /> بانتظار التحضير</span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-teal-400" /> قيد التجهيز</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.filter(o => o.status !== "ready").map((order) => (
              <Card 
                key={order.id} 
                className={`bg-slate-900 border-slate-800 text-slate-100 shadow-lg relative overflow-hidden transition-all duration-200 ${
                  order.status === "preparing" ? "border-t-4 border-t-teal-500" : "border-t-4 border-t-amber-500"
                }`}
              >
                <CardHeader className="py-3.5 border-b border-slate-800 bg-slate-950/30 flex flex-row items-center justify-between">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">{order.invoice_number}</span>
                    <span className="font-bold text-xs text-slate-200 mt-1 block">{order.customer_name}</span>
                  </div>
                  <Badge className={order.status === "preparing" ? "bg-teal-500 text-slate-950" : "bg-amber-500 text-slate-950"}>
                    {order.table_number || "دليفري"}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Order items list */}
                  <ul className="space-y-2.5">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-slate-100">{item.name}</span>
                        <span className="h-6 w-6 rounded-full bg-slate-950 flex items-center justify-center text-teal-400 border border-slate-800 text-[11px]">
                          x{item.qty}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-lg text-[10px] leading-relaxed flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span><strong>تنبيه الشيف:</strong> {order.notes}</span>
                    </div>
                  )}

                  {/* Operational Action triggers */}
                  <div className="pt-2 border-t border-slate-850 flex gap-2">
                    {order.status === "pending" ? (
                      <Button 
                        onClick={() => updateOrderStatus(order.id, "preparing")}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs h-9"
                      >
                        بدء التحضير
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => updateOrderStatus(order.id, "ready")}
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        جاهز للتسليم
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Side: Kitchen helper sidebar (Recipes, Costs) */}
        <div className="border-s border-slate-900 bg-slate-900/30 p-6 flex flex-col overflow-hidden text-right">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <BookOpen className="h-5 w-5 text-teal-400" />
            <h2 className="text-sm font-bold text-slate-100">دليل تحضير وتكلفة الوصفات</h2>
          </div>

          <div className="relative mb-4 shrink-0">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="ابحث عن وصفة للتحقق..."
              value={searchRecipe}
              onChange={(e) => setSearchRecipe(e.target.value)}
              className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-9 ps-9"
            />
          </div>

          {/* Recipes sheet cards */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {filteredRecipes.map((recipe, idx) => (
              <div key={idx} className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs text-slate-200">{recipe.name}</h3>
                  <div className="flex gap-1.5">
                    <Badge tone="default" className="text-[10px] bg-teal-500/10 text-teal-400 border-none">التكلفة: {recipe.cost}</Badge>
                    <Badge tone="default" className="text-[10px] bg-teal-500/10 text-teal-400 border-none">{recipe.costPct}</Badge>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/40 p-2 rounded-lg">
                  {recipe.prep}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Stateful Internal Chat Drawer */}
      <InternalChatDrawer 
        isOpen={chatOpen} 
        onClose={() => setChatOpen(false)} 
        orgId={device.orgId} 
        branchId={device.branchId} 
        currentRole={device.role} 
        currentName="شيف المطبخ" 
      />
    </div>
  );
}
