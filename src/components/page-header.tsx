import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-lg border bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.035)] md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-normal text-slate-950">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
