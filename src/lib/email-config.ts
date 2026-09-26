/** SMTP + brand settings. Edit `.env.local` (see `.env.example`). */
export function emailConfig() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const fromEmail = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "";
  const fromName = process.env.SMTP_FROM_NAME ?? process.env.APP_NAME ?? "ChessLab";
  return {
    host: process.env.SMTP_HOST ?? "",
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: fromEmail.includes("<") ? fromEmail : fromName && fromEmail ? `${fromName} <${fromEmail}>` : fromEmail,
    appName: process.env.APP_NAME ?? "ChessLab",
    appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    otpMinutes: Number(process.env.OTP_MINUTES ?? 10),
  };
}

export function emailReady(): boolean {
  const c = emailConfig();
  return Boolean(c.host && c.user && c.pass && (c.from || c.user));
}
