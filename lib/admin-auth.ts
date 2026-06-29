import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  ADMIN_ROLES,
  OWNER_ROLES,
  needsEmailReconfirmation,
  type AdminRole,
} from "@/lib/admin-roles";

export type { AdminRole } from "@/lib/admin-roles";
export { ADMIN_ROLES, OWNER_ROLES, needsEmailReconfirmation } from "@/lib/admin-roles";

export type AdminSessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  lastEmailVerification: Date | null;
};

type AuthSuccess = { ok: true; user: AdminSessionUser };
type AuthFailure = { ok: false; response: NextResponse };
export type AuthResult = AuthSuccess | AuthFailure;

export async function requireAdminSession(): Promise<AuthResult> {
  const session = await auth();
  const sessionUser = session?.user as { id?: string } | undefined;

  if (!sessionUser?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      lastEmailVerification: true,
    },
  });

  if (!dbUser) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!ADMIN_ROLES.includes(dbUser.role as AdminRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (needsEmailReconfirmation(dbUser.lastEmailVerification)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Email verification required" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as AdminRole,
      lastEmailVerification: dbUser.lastEmailVerification,
    },
  };
}

export async function requireOwnerSession(): Promise<AuthResult> {
  const result = await requireAdminSession();
  if (!result.ok) {
    return result;
  }

  if (!OWNER_ROLES.includes(result.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return result;
}
