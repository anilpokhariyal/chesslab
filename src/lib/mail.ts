import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { emailConfig, emailReady } from "./email-config";

type MailUser = { name: string; email: string };

function wrap(appName: string, title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#10141a;font-family:Georgia,Times,serif;color:#e8edf4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#10141a;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1c2430;border:1px solid #2a3444;border-radius:12px;padding:32px;">
          <tr>
            <td style="font-family:system-ui,sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#4eb882;padding-bottom:16px;">${appName}</td>
          </tr>
          <tr>
            <td style="font-size:24px;line-height:1.3;padding-bottom:16px;">${title}</td>
          </tr>
          <tr>
            <td style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#c5cdd8;">${body}</td>
          </tr>
          <tr>
            <td style="font-family:system-ui,sans-serif;font-size:12px;color:#8b97a8;padding-top:28px;border-top:1px solid #2a3444;margin-top:24px;">
              You received this because you signed up for ${appName}. If that was not you, you can ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  const c = emailConfig();
  if (!emailReady()) {
    // ponytail: no SMTP in local/dev → write the message so signup still works
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env.local.");
    }
    const dir = join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    const p = join(dir, "last-email.txt");
    const prev = existsSync(p) ? `${readFileSync(p, "utf8")}\n---\n` : "";
    writeFileSync(p, `${prev}${subject}\nTo: ${to}\n\n${text}\n`);
    console.warn(`[mail] SMTP not set. Saved to data/last-email.txt\n${text}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  await transport.sendMail({ from: c.from, to, subject, text, html });
}

export async function sendWelcomeEmail(user: MailUser): Promise<void> {
  const { appName, appUrl } = emailConfig();
  const subject = `Welcome to ${appName}`;
  const text = [
    `Hello ${user.name},`,
    ``,
    `Welcome to ${appName}. Your account is ready.`,
    ``,
    `You can analyze games from a PGN, Chess.com, or Lichess, run Stockfish in your browser, and train with puzzles and bots.`,
    ``,
    `Open the analyzer: ${appUrl}`,
    ``,
    `If you did not create this account, you can ignore this email.`,
    ``,
    `— The ${appName} team`,
  ].join("\n");
  const html = wrap(
    appName,
    `Welcome, ${user.name}.`,
    `<p>Thank you for joining ${appName}. Your account is ready.</p>
     <p>Analyze games from a PGN, Chess.com, or Lichess. Stockfish runs in your browser. Puzzles and bots are ready when you are.</p>
     <p style="padding:16px 0;"><a href="${appUrl}" style="background:#3d9b6e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-family:system-ui,sans-serif;">Open ${appName}</a></p>
     <p>We are glad you are here.</p>`,
  );
  await sendMail(user.email, subject, text, html);
}

export async function sendOtpEmail(user: MailUser, code: string): Promise<void> {
  const { appName, otpMinutes } = emailConfig();
  const subject = `Your ${appName} verification code`;
  const text = [
    `Hello ${user.name},`,
    ``,
    `Your ${appName} verification code is ${code}.`,
    ``,
    `It expires in ${otpMinutes} minutes. Enter it on the verification page to finish creating your account.`,
    ``,
    `If you did not sign up, ignore this email.`,
    ``,
    `— The ${appName} team`,
  ].join("\n");
  const html = wrap(
    appName,
    "Verify your email",
    `<p>Hello ${user.name}, use this code to finish setting up your ${appName} account.</p>
     <p style="font-size:32px;letter-spacing:0.28em;font-weight:700;color:#e8edf4;padding:12px 0;font-family:ui-monospace,monospace;">${code}</p>
     <p>This code expires in ${otpMinutes} minutes.</p>`,
  );
  await sendMail(user.email, subject, text, html);
}
