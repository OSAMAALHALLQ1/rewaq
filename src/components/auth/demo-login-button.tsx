"use client";

import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export function DemoLoginButton() {
  const handleDemoClick = () => {
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const passwordInput = document.getElementById("password") as HTMLInputElement;
    if (emailInput && passwordInput) {
      emailInput.value = "osama";
      passwordInput.value = "osamaalhallqst9";
      const form = emailInput.closest("form");
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <Button
      type="button"
      onClick={handleDemoClick}
      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 font-bold shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2"
    >
      <Clock className="h-4 w-4" />
      دخول تجريبي مجاني (صلاحية ساعتين)
    </Button>
  );
}
