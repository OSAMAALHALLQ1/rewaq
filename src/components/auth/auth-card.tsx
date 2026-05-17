import Link from "next/link";
import { Leaf } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="text-2xl font-bold text-primary">رواق</span>
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </CardHeader>
          <CardContent>
            {children}
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
