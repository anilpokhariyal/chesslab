import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/app/auth-actions";
import { VerifyForm } from "@/components/VerifyForm";
import { meta } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Verify email",
  description: "Enter the 6-digit code we sent to finish signing up.",
  path: "/verify",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const { email = "" } = await searchParams;
  return (
    <>
      <h1 className="page-title">Verify your email</h1>
      <p className="lede">We sent a 6-digit code and a welcome note. Enter the code to finish signing up.</p>
      <VerifyForm email={email} />
      <p className="muted" style={{ marginTop: 12 }}>
        <Link href="/signin">Back to sign in</Link>
      </p>
    </>
  );
}
