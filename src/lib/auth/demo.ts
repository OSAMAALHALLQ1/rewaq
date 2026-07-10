/**
 * Pure helper to detect the configured demo account.
 *
 * Lives OUTSIDE any "use server" module so it can be a synchronous function
 * and still be importable from both server and client code. The demo email is
 * provided via the server-only RAWAQ_DEMO_EMAIL env var — never hard-coded.
 */
export function isDemoUserEmail(email?: string | null): boolean {
  const demoEmail = process.env.RAWAQ_DEMO_EMAIL;
  if (!demoEmail || !email) return false;
  return email.trim().toLowerCase() === demoEmail.trim().toLowerCase();
}
