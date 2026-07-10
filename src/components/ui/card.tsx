import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "dark" | "primary" | "light" | "muted";

const cardVariants: Record<CardVariant, string> = {
  default: "border-[var(--border-subtle)] bg-card text-card-foreground",
  dark: "border-secondary bg-secondary text-secondary-foreground",
  primary: "border-primary bg-primary text-primary-foreground",
  light: "border-primary-light bg-primary-light text-primary-light-foreground",
  muted: "border-muted bg-muted text-foreground",
};

export function Card({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      className={cn("rounded-2xl border shadow-xs", cardVariants[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-extrabold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
