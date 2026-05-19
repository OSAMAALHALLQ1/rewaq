"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
};

export function Modal({ open, title, description, children, onClose, className }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm print:hidden sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "max-h-[88vh] w-full overflow-hidden rounded-t-2xl border bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b p-4">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="max-h-[calc(88vh-80px)] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
