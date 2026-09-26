import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSessionUser } from "@/app/auth-actions";
import { meta } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Sign up",
  description: "Create a ChessLab account. We email a verification code.",
  path: "/signup",
  index: false,
});

export default async function Page() {
  if (await getSessionUser()) redirect("/");
  return (
    <>
      <h1 className="page-title">Sign up</h1>
      <p className="lede">Create an account. We will email a welcome note and a 6-digit code to verify your address.</p>
      <AuthForm mode="signup" />
      <p className="muted" style={{ marginTop: 12 }}>
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </>
  );
}
