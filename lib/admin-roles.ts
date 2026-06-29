export type AdminRole = "ADMIN" | "OWNER" | "PROPERTY_MANAGER";

export const ADMIN_ROLES: AdminRole[] = ["ADMIN", "OWNER", "PROPERTY_MANAGER"];
export const OWNER_ROLES: AdminRole[] = ["ADMIN", "OWNER"];

export const EMAIL_VERIFICATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function needsEmailReconfirmation(
  lastEmailVerification: Date | null | undefined
): boolean {
  const lastMs = lastEmailVerification?.getTime() ?? 0;
  return !lastMs || Date.now() - lastMs > EMAIL_VERIFICATION_MAX_AGE_MS;
}
