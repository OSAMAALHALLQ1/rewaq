import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <h1 className="text-5xl font-black text-primary">404</h1>
        <p className="mt-3 text-lg font-semibold">الصفحة غير موجودة</p>
        <p className="mt-2 text-sm text-muted-foreground">قد يكون الرابط تغير أو لا تملك صلاحية الوصول.</p>
        <Button className="mt-6" asChild>
          <Link href="/dashboard">العودة للوحة التحكم</Link>
        </Button>
      </div>
    </div>
  );
}
