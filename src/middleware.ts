import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only protect /admin routes
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get("admin_session")?.value;
    
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/admin-login", request.url));
    }

    try {
      const secretKey = process.env.INTERNAL_ADMIN_SECRET;
      if (!secretKey) {
        throw new Error("No secret key configured");
      }
      
      const key = new TextEncoder().encode(secretKey);
      await jwtVerify(sessionCookie, key, { algorithms: ["HS256"] });
      
      // Token is valid, allow request
      return NextResponse.next();
    } catch (error) {
      // Token is invalid or expired
      return NextResponse.redirect(new URL("/admin-login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
