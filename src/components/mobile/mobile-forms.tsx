"use client";

import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface MobileFormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Mobile form field wrapper
 * Provides consistent spacing and error/hint display
 */
export function MobileFormField({
  label,
  required,
  error,
  hint,
  children,
  className,
}: MobileFormFieldProps) {
  return (
    <div className={cn("mb-4 md:mb-6", className)}>
      <label className="block text-sm md:text-base font-semibold text-slate-900 mb-2">
        {label}
        {required && <span className="text-destructive ms-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-2 text-xs md:text-sm text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="mt-2 text-xs md:text-sm text-destructive font-semibold">{error}</p>
      )}
    </div>
  );
}

interface MobileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

/**
 * Mobile-optimized input
 * Larger touch targets, better font sizing
 */
export function MobileInput({
  label,
  error,
  hint,
  icon,
  className,
  ...props
}: MobileInputProps) {
  if (label) {
    return (
      <MobileFormField label={label} error={error} hint={hint}>
        <MobileInput {...props} />
      </MobileFormField>
    );
  }

  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
      )}
      <input
        type="text"
        className={cn(
          "w-full h-11 md:h-12 rounded-lg border border-input bg-white px-4 md:px-5 text-base md:text-lg",
          "placeholder-muted-foreground transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          icon && "ps-10 md:ps-12",
          error && "border-destructive focus:ring-destructive/50",
          className
        )}
        {...props}
      />
    </div>
  );
}

interface MobileSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
}

/**
 * Mobile-optimized select
 * Better spacing and touch targets than standard select
 */
export function MobileSelect({
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  ...props
}: MobileSelectProps) {
  if (label) {
    return (
      <MobileFormField label={label} error={error} hint={hint}>
        <MobileSelect options={options} placeholder={placeholder} {...props} />
      </MobileFormField>
    );
  }

  return (
    <select
      className={cn(
        "w-full h-11 md:h-12 rounded-lg border border-input bg-white px-4 md:px-5 text-base md:text-lg",
        "placeholder-muted-foreground transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-no-repeat",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22currentColor%22%20stroke-width=%222%22%3E%3Cpath%20d=%22m19%209-7%207-7-7%22/%3E%3C/svg%3E')] bg-[length:1.5rem] bg-[position:_right_0.5rem_center] pe-9 md:pe-10",
        error && "border-destructive focus:ring-destructive/50",
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface MobileTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Mobile-optimized textarea
 * Larger text, better for mobile typing
 */
export function MobileTextarea({
  label,
  error,
  hint,
  className,
  ...props
}: MobileTextareaProps) {
  if (label) {
    return (
      <MobileFormField label={label} error={error} hint={hint}>
        <MobileTextarea {...props} />
      </MobileFormField>
    );
  }

  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-input bg-white px-4 md:px-5 py-3 md:py-4 text-base md:text-lg",
        "placeholder-muted-foreground transition-colors resize-vertical min-h-24 md:min-h-32",
        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        error && "border-destructive focus:ring-destructive/50",
        className
      )}
      {...props}
    />
  );
}

interface MobileCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

/**
 * Mobile-optimized checkbox
 * Larger touch target
 */
export function MobileCheckbox({
  label,
  description,
  className,
  ...props
}: MobileCheckboxProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer rounded-lg px-3 py-2 hover:bg-slate-50 transition">
      <input
        type="checkbox"
        className={cn(
          "mt-1 h-5 w-5 md:h-6 md:w-6 rounded border border-input bg-white",
          "transition-colors accent-primary cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          className
        )}
        {...props}
      />
      {(label || description) && (
        <div className="flex-1">
          {label && <p className="text-sm md:text-base font-semibold text-slate-900">{label}</p>}
          {description && (
            <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
    </label>
  );
}

interface MobileRadioGroupProps {
  label?: string;
  options: Array<{
    value: string | number;
    label: string;
    description?: string;
  }>;
  value?: string | number;
  onChange?: (value: string | number) => void;
  className?: string;
}

/**
 * Mobile-optimized radio group
 * Better spacing between options
 */
export function MobileRadioGroup({
  label,
  options,
  value,
  onChange,
  className,
}: MobileRadioGroupProps) {
  return (
    <div className={className}>
      {label && <p className="text-sm md:text-base font-semibold text-slate-900 mb-3">{label}</p>}
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-3 cursor-pointer rounded-lg border border-border px-4 py-3 md:py-4 hover:bg-slate-50 transition"
          >
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange?.(e.target.value)}
              className="mt-1 h-5 w-5 md:h-6 md:w-6 rounded-full border-2 border-input bg-white accent-primary cursor-pointer"
            />
            <div className="flex-1">
              <p className="text-sm md:text-base font-semibold text-slate-900">{option.label}</p>
              {option.description && (
                <p className="text-xs md:text-sm text-muted-foreground">{option.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
