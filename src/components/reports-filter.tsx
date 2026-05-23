"use client";

import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";

export function ReportsFilter({
  activeReport,
  reportOptions,
}: {
  activeReport: string;
  reportOptions: string[][];
}) {
  const router = useRouter();

  return (
    <Select
      className="max-w-80"
      value={activeReport}
      onChange={(e) => {
        router.push(`/dashboard/reports?type=${e.target.value}`);
      }}
    >
      {reportOptions.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}
