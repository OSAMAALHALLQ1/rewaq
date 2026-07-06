"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  const isScopeError = error.message.includes("organization scope");
  const isSupabaseError = error.message.includes("Supabase admin environment");

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center" dir="rtl">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <h2 className="text-xl font-bold">تعذر تحميل الصفحة</h2>
        <p className="max-w-xl text-sm leading-7 text-muted-foreground">{error.message}</p>

        {isScopeError && (
          <p className="max-w-xl text-xs leading-6 text-amber-600 bg-amber-50 rounded-lg p-3">
            لا يوجد لك صف عضوية في منظمة بعد. تواصل مع مدير المنظمة لإضافتك، أو سجّل الدخول بحساب مدير.
          </p>
        )}
        {isSupabaseError && (
          <p className="max-w-xl text-xs leading-6 text-amber-600 bg-amber-50 rounded-lg p-3">
            إعدادات Supabase غير مكتملة. تأكد من ضبط مفاتيح Supabase في ملف البيئة، أو فعّل وضع التجربة (RAWAQ_DEMO_MODE=true) في التطوير.
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            حاول مرة أخرى
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              الرئيسية
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
