import nodemailer from "nodemailer";

let _transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (_transport) return _transport;

  const user = process.env.GMAIL_ADDRESS;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn("[mailer] GMAIL_ADDRESS or GMAIL_APP_PASSWORD not set – emails will be logged to console only.");
    return null;
  }

  _transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return _transport;
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

  const transport = getTransport();

  if (!transport) {
    // Dev fallback: just print it
    console.info(`[mailer] ${purpose} email code for <${to}>: ${code}`);
    return;
  }

  try {
    await transport.sendMail({
      from: `"AlbumAtlas" <${process.env.GMAIL_ADDRESS}>`,
      to,
      subject,
      text,
      html,
    });
    console.info(`[mailer] Sent ${purpose} verification code to ${to}`);
  } catch (err) {
    console.error("[mailer] Failed to send email:", err);
    // Don't rethrow – fall back to console so auth still works if email is misconfigured
    console.info(`[mailer] Fallback – ${purpose} code for <${to}>: ${code}`);
  }
}
