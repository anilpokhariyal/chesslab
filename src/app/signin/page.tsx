import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSessionUser } from "@/app/auth-actions";
import { meta } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Sign in",
  description: "Sign in to your ChessLab account.",
  path: "/signin",
  index: false,
});

export default async function Page() {
  if (await getSessionUser()) redirect("/");
  return (
    <>
      <h1 className="page-title">Sign in</h1>
      <p className="lede">Use the email and password you registered with.</p>
      <AuthForm mode="signin" />
      <p className="muted" style={{ marginTop: 12 }}>
        No account? <Link href="/signup">Sign up</Link>
      </p>
    </>
  );
}
