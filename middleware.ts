import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { ADMIN_ROLES, needsEmailReconfirmation } from "@/lib/admin-roles";

const { auth } = NextAuth(authConfig);

const ADMIN_ROLE_SET = new Set<string>(ADMIN_ROLES);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin");

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  const user = req.auth?.user as
    | {
        email?: string | null;
        role?: string;
        lastEmailVerification?: Date | string | null;
      }
    | undefined;

  if (!user) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!user.role || !ADMIN_ROLE_SET.has(user.role)) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAdminPage) {
    const lastVerification =
      user.lastEmailVerification != null
        ? new Date(user.lastEmailVerification)
        : null;

    if (needsEmailReconfirmation(lastVerification)) {
      const email = user.email ?? "";
      const verifyUrl = new URL("/verify", req.url);
      verifyUrl.searchParams.set("email", email);
      return NextResponse.redirect(verifyUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
