"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE,
  consumeOtp,
  createUser,
  findByEmail,
  findUser,
  issueOtp,
  makeToken,
  readToken,
  verifyUser,
} from "@/lib/auth";
import { sendOtpEmail, sendWelcomeEmail } from "@/lib/mail";

async function setSession(id: string) {
  const jar = await cookies();
  jar.set(COOKIE, makeToken(id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getSessionUser() {
  const jar = await cookies();
  const id = readToken(jar.get(COOKIE)?.value ?? "");
  const user = id ? findUser(id) : null;
  return user?.verified ? user : null;
}

export async function signup(_prev: string, form: FormData): Promise<string> {
  let email = "";
  try {
    const user = createUser(
      String(form.get("name") ?? ""),
      String(form.get("email") ?? ""),
      String(form.get("password") ?? ""),
    );
    email = user.email;
    const otp = issueOtp(user.email);
    await sendOtpEmail(user, otp);
    await sendWelcomeEmail(user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign up failed.";
    if (email) return `${msg} You can request a new code on the verify page.`;
    return msg;
  }
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

export async function login(_prev: string, form: FormData): Promise<string> {
  const user = verifyUser(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!user) return "Invalid email or password.";
  if (!user.verified) redirect(`/verify?email=${encodeURIComponent(user.email)}`);
  await setSession(user.id);
  redirect("/");
}

export async function verifyEmail(_prev: string, form: FormData): Promise<string> {
  try {
    const user = consumeOtp(String(form.get("email") ?? ""), String(form.get("code") ?? ""));
    await setSession(user.id);
  } catch (e) {
    return e instanceof Error ? e.message : "Verification failed.";
  }
  redirect("/");
}

export async function resendOtp(_prev: string, form: FormData): Promise<string> {
  const email = String(form.get("email") ?? "");
  try {
    const user = findByEmail(email);
    if (!user) return "No account with that email.";
    if (user.verified) return "That email is already verified. Sign in.";
    const otp = issueOtp(user.email);
    await sendOtpEmail(user, otp);
  } catch (e) {
    return e instanceof Error ? e.message : "Could not resend the code.";
  }
  return "A new code is on its way.";
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/");
}
