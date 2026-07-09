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
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-3 rounded-full bg-white px-4 py-2 shadow-soft">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="text-2xl font-extrabold text-primary">رواق</span>
        </Link>
        <Card className="border-border/80">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{title}</CardTitle>
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