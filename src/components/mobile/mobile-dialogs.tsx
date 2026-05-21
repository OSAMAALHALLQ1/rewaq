"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface MobileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  fullscreen?: boolean;
}

/**
 * Mobile-optimized dialog/modal
 * Slides up from bottom on mobile, centered on desktop
 */
export function MobileDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  fullscreen = false,
}: MobileDialogProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "md:max-w-sm",
    md: "md:max-w-md",
    lg: "md:max-w-lg",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
        <div
          className={cn(
            "w-full bg-white rounded-t-2xl md:rounded-xl shadow-2xl transition-all md:rounded-lg",
            fullscreen ? "h-screen md:h-auto md:max-h-[90vh]" : "max-h-[90vh]",
            !fullscreen && sizeClasses[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-4 md:px-6 py-4 md:py-5 rounded-t-2xl md:rounded-t-lg">
            <div className="flex-1">
              {title && (
                <h2 className="text-lg md:text-xl font-bold text-slate-900">{title}</h2>
              )}
              {description && (
                <p className="text-sm md:text-base text-muted-foreground mt-1">{description}</p>
              )}
            </div>

            <button
              onClick={onClose}
              className="ms-2 p-2 -me-2 hover:bg-slate-100 rounded-lg transition"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-4 md:px-6 py-4 md:py-5">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-border bg-slate-50 px-4 md:px-6 py-4 md:py-5 rounded-b-2xl md:rounded-b-lg">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "start" | "end";
}

/**
 * Mobile-optimized sheet (side drawer)
 * Slides in from side on desktop, full-width overlay on mobile
 */
export function MobileSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  side = "end",
}: MobileSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          "fixed inset-y-0 top-0 z-50 w-full md:max-w-sm bg-white shadow-2xl transition-transform overflow-y-auto flex flex-col",
          side === "end" ? "start-auto end-0" : "start-0 end-auto",
          isOpen ? "translate-x-0" : side === "end" ? "translate-x-full" : "-translate-x-full"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-4 md:px-6 py-4 md:py-5">
            <h2 className="text-lg md:text-xl font-bold text-slate-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 -me-2 hover:bg-slate-100 rounded-lg transition"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-border bg-slate-50 px-4 md:px-6 py-4 md:py-5">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

interface MobileAlertProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: "info" | "warning" | "danger" | "success";
}

/**
 * Mobile-optimized alert dialog
 */
export function MobileAlert({
  isOpen,
  onClose,
  title,
  message,
  confirmText = "موافق",
  cancelText = "إلغاء",
  onConfirm,
  onCancel,
  variant = "info",
}: MobileAlertProps) {
  if (!isOpen) return null;

  const variantStyles = {
    info: "text-blue-600 bg-blue-50",
    warning: "text-orange-600 bg-orange-50",
    danger: "text-red-600 bg-red-50",
    success: "text-green-600 bg-green-50",
  };

  const confirmButtonStyles = {
    info: "bg-blue-600 hover:bg-blue-700 text-white",
    warning: "bg-orange-600 hover:bg-orange-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Alert */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full md:max-w-sm bg-white rounded-lg shadow-2xl overflow-hidden">
          {/* Content */}
          <div className={cn("px-4 md:px-6 py-6 md:py-8", variantStyles[variant])}>
            <h3 className="text-lg md:text-xl font-bold mb-2">{title}</h3>
            <p className="text-sm md:text-base opacity-90">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-border bg-slate-50 px-4 md:px-6 py-4 md:py-5">
            <button
              onClick={() => {
                onCancel?.();
                onClose();
              }}
              className="flex-1 h-10 md:h-11 rounded-lg border border-input bg-white hover:bg-slate-100 text-sm md:text-base font-semibold transition"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm?.();
                onClose();
              }}
              className={cn(
                "flex-1 h-10 md:h-11 rounded-lg text-sm md:text-base font-semibold transition",
                confirmButtonStyles[variant]
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface MobilePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
}

/**
 * Mobile-optimized popover
 * Anchored to trigger element on desktop, full-width drawer on mobile
 */
export function MobilePopover({
  isOpen,
  onClose,
  trigger: _trigger,
  children,
  align: _align = "center",
}: MobilePopoverProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover Content */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:absolute md:bottom-auto rounded-t-2xl md:rounded-lg bg-white border border-border shadow-xl md:shadow-lg md:min-w-48">
        <div className="px-4 md:px-3 py-4 md:py-2 max-h-80 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
