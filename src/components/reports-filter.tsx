"use client";

import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";

export function ReportsFilter({
  activeReport,
  reportOptions,
  startDate,
  endDate,
  branchId,
  branches,
}: {
  activeReport: string;
  reportOptions: string[][];
  startDate: string;
  endDate: string;
  branchId: string;
  branches: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  const updateFilter = (name: string, value: string) => {
    const params = new URLSearchParams();
    params.set("type", activeReport);
    params.set("start", startDate);
    params.set("end", endDate);
    if (branchId) params.set("branch", branchId);
    if (value) params.set(name, value);
    else params.delete(name);
    router.push(`/dashboard/reports?${params.toString()}`);
  };

  return (
    <>
      <input
        aria-label="تاريخ البداية"
        className="h-9 max-w-44 rounded-md border border-input bg-background px-3 text-sm"
        type="date"
        value={startDate}
        onChange={(e) => updateFilter("start", e.target.value)}
      />
      <input
        aria-label="تاريخ النهاية"
        className="h-9 max-w-44 rounded-md border border-input bg-background px-3 text-sm"
        type="date"
        value={endDate}
        onChange={(e) => updateFilter("end", e.target.value)}
      />
      <Select className="max-w-64" value={branchId} onChange={(e) => updateFilter("branch", e.target.value)}>
        <option value="">كل الأقسام</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </Select>
      <Select className="max-w-80" value={activeReport} onChange={(e) => updateFilter("type", e.target.value)}>
        {reportOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </>
  );
}
