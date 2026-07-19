"use client";

import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoLoginFormAction } from "@/server/actions/auth";

export function DemoLoginButton() {
  return (
    <form action={demoLoginFormAction}>
      <Button type="submit" className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
        <Clock className="h-4 w-4" aria-hidden="true" />
        دخول تجريبي مجاني لمدة 8 ساعات
      </Button>
    </form>
  );
}
