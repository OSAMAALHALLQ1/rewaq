"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** فتح لوحة الأوامر — detail اختياري: { query: string } لتعبئة البحث مسبقاً */
export const COMMAND_PALETTE_EVENT = "rewaq:command-palette";

/**
 * إنشاء سجل جديد ذكي (Alt+N): يُطلق حدثاً قابلاً للإلغاء؛ الصفحة الحالية
 * تستمع وتفتح لوحة الإضافة الخاصة بها مع استدعاء preventDefault().
 * إن لم تعالجه أي صفحة، تُفتح لوحة الأوامر كبديل.
 */
export const SMART_NEW_EVENT = "rewaq:smart-new";

export function openCommandPalette(query?: string) {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT, { detail: { query } }));
}

// نستخدم e.code (موضع الزر الفيزيائي) وليس e.key حتى تعمل الاختصارات
// مع تخطيط لوحة المفاتيح العربية دون تغيير اللغة.
const ALT_ROUTES: Record<string, string> = {
  KeyP: "/d/pos",
  KeyI: "/dashboard/inventory",
  KeyS: "/dashboard/suppliers",
  KeyD: "/dashboard/reports",
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function GlobalHotkeys() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+K / Cmd+K: لوحة الأوامر — تعمل حتى داخل حقول الإدخال
      const isK = e.code === "KeyK" || e.key.toLowerCase() === "k" || e.key === "ن";
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && isK) {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (isEditableTarget(e.target)) return;

      if (e.code === "KeyN") {
        e.preventDefault();
        const smartNew = new CustomEvent(SMART_NEW_EVENT, { cancelable: true });
        const unhandled = window.dispatchEvent(smartNew);
        if (unhandled) openCommandPalette("جديد");
        return;
      }

      const route = ALT_ROUTES[e.code];
      if (route) {
        e.preventDefault();
        router.push(route);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
