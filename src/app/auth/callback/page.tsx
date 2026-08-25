"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSafeAuthCallbackNext } from "@/lib/auth/callback";
import { createClient } from "@/lib/supabase/client";

const INVALID_LINK_MESSAGE = "تعذر إكمال الدخول. افتح أحدث رابط وصلك عبر البريد أو تواصل مع الإدارة.";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      // Supabase returns failures in URL parameters/fragments. Never reflect
      // provider details, codes, or tokens back into the interface.
      if (query.has("error") || fragment.has("error")) {
        if (!cancelled) setError(INVALID_LINK_MESSAGE);
        return;
      }

      const supabase = createClient();
      const code = query.get("code");
      let authError: Error | null = null;

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        authError = exchangeError;
      } else {
        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");

        if (!accessToken || !refreshToken) {
          if (!cancelled) setError(INVALID_LINK_MESSAGE);
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        authError = sessionError;
      }

      if (authError) {
        if (!cancelled) setError(INVALID_LINK_MESSAGE);
        return;
      }

      router.replace(getSafeAuthCallbackNext(query.get("next")));
      router.refresh();
    }

    void completeSignIn().catch(() => {
      if (!cancelled) setError(INVALID_LINK_MESSAGE);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-muted px-4" dir="rtl">
      <section className="w-full max-w-md rounded-2xl bg-background p-6 text-center shadow-soft">
        {error ? (
          <>
            <h1 className="text-xl font-bold">تعذر تسجيل الدخول</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p>
            <Link href="/login" className="mt-5 inline-block font-semibold text-primary hover:underline">
              العودة إلى تسجيل الدخول
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">جارِ تسجيل الدخول</h1>
            <p className="mt-3 text-sm text-muted-foreground">يرجى الانتظار لحظة.</p>
          </>
        )}
      </section>
    </main>
  );
}
