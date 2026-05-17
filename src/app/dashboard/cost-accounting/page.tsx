import { PageHeader } from "@/components/page-header";
import { CostAccountingCalculator } from "@/components/costing/cost-accounting-calculator";

export default function CostAccountingPage() {
  return (
    <>
      <PageHeader
        title="محاسبة التكاليف"
        description="حاسبة يومية لمعرفة تكلفة المنتج الحقيقية من المواد الخام، الأجور، المصاريف، وسعر البيع."
      />
      <CostAccountingCalculator />
    </>
  );
}
