import { PageHeader } from "@/components/page-header";
import { CostAccountingCalculator } from "@/components/costing/cost-accounting-calculator";

export default function CostAccountingPage() {
  return (
    <>
      <PageHeader
        title="محاسبة التكاليف"
        description="محرك مطاعم لحساب الريسبي، مراحل الإنتاج، الإهلاك، المستودعات، الكاشير، الانحرافات، وهندسة المنيو."
      />
      <CostAccountingCalculator />
    </>
  );
}
