/** Должен совпадать с getAdminDeleteEmail() в API (или переменная ADMIN_DELETE_EMAIL). */
export const ADMIN_DELETE_EMAIL = "info@growixcontent.com";

export function isAdminDeleteEmail(
  email: string | null | undefined,
): boolean {
  if (!email?.trim()) return false;
  return email.trim().toLowerCase() === ADMIN_DELETE_EMAIL.toLowerCase();
}
