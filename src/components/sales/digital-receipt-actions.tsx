"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DigitalReceiptActions() {
  function printOrSave() {
    window.print();
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={printOrSave}>
        <Download className="h-4 w-4" />
        حفظ
      </Button>
      <Button onClick={printOrSave}>
        <Printer className="h-4 w-4" />
        طباعة
      </Button>
    </div>
  );
}
