import { describe, expect, it } from "vitest";

import { formatCurrency } from "@/lib/utils";

describe("formatCurrency", () => {
  it("uses the system shekel currency when no override is supplied", () => {
    const formatted = formatCurrency(125);

    expect(formatted).toContain("₪");
    expect(formatted).not.toContain("د.أ");
    expect(formatCurrency(125, "JOD")).toContain("د.أ");
  });
});
