import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[mailer] RESEND_API_KEY not set – emails will be logged to console only.");
    return null;
  }
  _resend = new Resend(apiKey);
  return _resend;
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: "login" | "recovery",
): Promise<void> {
  const subject =
    purpose === "login"
      ? "AlbumAtlas – Your Login Verification Code"
      : "AlbumAtlas – Your Password Recovery Code";

  const text =
    `Your AlbumAtlas verification code is:\n\n` +
    `    ${code}\n\n` +
    `This code expires in 5 minutes. If you did not request this, please ignore this email.`;

  const html =
    `<div style="font-family:sans-serif;max-width:480px;margin:auto">` +
    `<h2 style="color:#3f3f46">AlbumAtlas Verification</h2>` +
    `<p>Your verification code is:</p>` +
    `<div style="font-size:2.5rem;font-weight:bold;letter-spacing:0.2em;` +
    `padding:16px;background:#f4f4f5;border-radius:8px;text-align:center;color:#18181b">` +
    `${code}</div>` +
    `<p style="color:#71717a;font-size:0.85rem">` +
    `This code expires in 5 minutes. If you did not request this, please ignore this email.</p>` +
    `</div>`;

  const resend = getResend();

  if (!resend) {
    console.info(`[mailer] ${purpose} email code for <${to}>: ${code}`);
    return;
  }

  try {
    await resend.emails.send({
      from: "AlbumAtlas <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
      html,
    });
    console.info(`[mailer] Sent ${purpose} verification code to ${to}`);
  } catch (err) {
    console.error("[mailer] Failed to send email:", err);
    console.info(`[mailer] Fallback – ${purpose} code for <${to}>: ${code}`);
  }
}
