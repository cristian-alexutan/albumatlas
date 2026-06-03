export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: "login" | "recovery",
): Promise<void> {
  // Email sending is logged to console – check Railway logs for the code.
  console.info(`[mailer] ${purpose} email code for <${to}>: ${code}`);
}
