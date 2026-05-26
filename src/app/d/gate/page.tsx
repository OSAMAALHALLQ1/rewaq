"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { KeyRound, ShieldAlert, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function GatewayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If the key is provided in the URL parameter, authenticate immediately
    const keyParam = searchParams.get("key");
    if (keyParam) {
      setApiKey(keyParam);
      handleAuthenticate(keyParam);
    }
  }, [searchParams]);

  const handleAuthenticate = async (keyToSubmit: string) => {
    if (!keyToSubmit || keyToSubmit.trim().length !== 10) {
      setError("الرمز يجب أن يكون مكوناً من 10 رموز بالضبط.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/department-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToSubmit.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "رمز غير صالح أو تم إلغاء تنشيطه.");
      }

      // Store device credentials in localStorage for API-driven requests
      localStorage.setItem("rwq_dept_key", data.token);
      localStorage.setItem("rwq_dept_role", data.role);
      localStorage.setItem("rwq_dept_org_id", data.organizationId);
      localStorage.setItem("rwq_dept_branch_id", data.branchId || "");
      localStorage.setItem("rwq_dept_allowed", JSON.stringify(data.allowedModules));
      localStorage.setItem("rwq_dept_device", data.deviceName);

      // Save cookie so server components can authorize next layouts
      document.cookie = `rwq_dept_token=${data.token}; path=/; max-age=31536000; SameSite=Lax`;

      // Redirect to the first permitted page based on allowed modules
      const allowed = data.allowedModules || [];
      
      if (allowed.includes("pos")) {
        router.push("/d/pos");
      } else if (allowed.includes("recipes")) {
        router.push("/d/kitchen");
      } else if (allowed.includes("inventory")) {
        router.push("/d/inventory");
      } else {
        // Fallback depending on role
        if (data.role === "cashier") {
          router.push("/d/pos");
        } else {
          router.push("/d/kitchen");
        }
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع أثناء التوثيق.");
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAuthenticate(apiKey);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-slate-950">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-10 -left-10 h-32 w-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <CardHeader className="text-center pt-8">
          <div className="mx-auto h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-4">
            <KeyRound className="h-6 w-6 animate-pulse" />
          </div>
          <CardTitle className="text-xl font-bold tracking-wide">بوابة ولوج الأقسام</CardTitle>
          <p className="text-xs text-slate-400 mt-2">
            يرجى إدخال رمز التوثيق (API Key) المكون من 10 رموز الممنوح من مدير المطعم لفتح القسم المخصص لجهازك.
          </p>
        </CardHeader>
        <CardContent className="pb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
              <p className="text-sm text-slate-300">يتم الآن توثيق الجهاز وفتح واجهة القسم...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-right">
              {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="apiKey" className="text-xs font-semibold text-slate-300 block">
                  كود القسم (API Key):
                </label>
                <div className="flex gap-2">
                  <Input
                    id="apiKey"
                    type="text"
                    maxLength={10}
                    placeholder="مثال: RWQ_A7B8C9"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-950 border-slate-800 text-slate-100 h-11 text-center font-mono tracking-widest text-lg placeholder:text-slate-700 placeholder:text-sm placeholder:tracking-normal focus:border-teal-500/50"
                    required
                  />
                  <Button type="submit" className="h-11 px-4 bg-teal-600 hover:bg-teal-700 text-white shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/40 border border-slate-800/50 p-3 text-[11px] leading-relaxed text-slate-400 text-center">
                ملاحظة: بمجرد الدخول، سيتم حفظ الجلسة على هذا الجهاز بشكل دائم لضمان استقرار العمل وعدم انقطاعه.
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DepartmentGatewayPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <GatewayContent />
    </Suspense>
  );
}
