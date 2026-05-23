"use client";

import { useState } from "react";

interface ReportSelectorProps {
  options: Array<{ value: string; label: string }>;
}

export function ReportSelector({ options }: ReportSelectorProps) {
  const [selected, setSelected] = useState(options[0]?.value ?? "");

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelected(value);
    const target = document.getElementById(value);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium leading-none" htmlFor="reportSelector">
        اختر التقرير
      </label>
      <select
        id="reportSelector"
        className="h-10 rounded-md border px-3 py-2 text-sm shadow-sm"
        value={selected}
        onChange={handleChange}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
"use client";

import { useState } from "react";

interface ReportSelectorProps {
  options: Array<{ value: string; label: string }>;
}

export function ReportSelector({ options }: ReportSelectorProps) {
  const [selected, setSelected] = useState(options[0]?.value ?? "");

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setSelected(value);
    const target = document.getElementById(value);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-secondary">اختر التقرير</label>
      <select
        value={selected}
        onChange={handleChange}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
