"use client";

import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { demoLoginFormAction } from "@/server/actions/auth";

export function DemoLoginButton() {
  return (
    <form action={demoLoginFormAction}>
      <Button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 font-bold shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2"
      >
        <Clock className="h-4 w-4" />
        دخول تجريبي مجاني (صلاحية ساعتين)
      </Button>
    </form>
  );
}
