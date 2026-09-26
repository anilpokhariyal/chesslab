import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { sendOtpEmail, sendWelcomeEmail } from "./mail.ts";

const prev = {
  NODE_ENV: process.env.NODE_ENV,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
};

function restore() {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

export async function run(): Promise<void> {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
  process.env.NODE_ENV = "test";

  await sendWelcomeEmail({ name: "Ada", email: "ada@example.com" });
  await sendOtpEmail({ name: "Ada", email: "ada@example.com" }, "123456");
  const saved = readFileSync(join(process.cwd(), "data", "last-email.txt"), "utf8");
  assert.match(saved, /Welcome/);
  assert.match(saved, /123456/);

  process.env.NODE_ENV = "production";
  await assert.rejects(
    () => sendOtpEmail({ name: "Ada", email: "ada@example.com" }, "000000"),
    /Email is not configured/,
  );

  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_USER = "u@x.com";
  process.env.SMTP_PASS = "pw";
  process.env.SMTP_FROM = "u@x.com";
  const orig = nodemailer.createTransport;
  let sent = 0;
  nodemailer.createTransport = (() => ({
    sendMail: async () => {
      sent += 1;
      return { messageId: "1" };
    },
  })) as typeof orig;
  await sendOtpEmail({ name: "Ada", email: "ada@example.com" }, "654321");
  await sendWelcomeEmail({ name: "Ada", email: "ada@example.com" });
  assert.equal(sent, 2);
  nodemailer.createTransport = orig;
  restore();
  assert.equal(existsSync(join(process.cwd(), "data", "last-email.txt")), true);
  console.log("mail ok");
}
