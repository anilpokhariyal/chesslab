"use client";

import { useActionState } from "react";
import { login, signup } from "@/app/auth-actions";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const [error, action] = useActionState(mode === "signin" ? login : signup, "");
  return (
    <form action={action} className="panel auth" style={{ maxWidth: 400 }}>
      {mode === "signup" && (
        <label>
          Name
          <input name="name" type="text" required maxLength={40} autoComplete="name" />
        </label>
      )}
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Password
        <input name="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
      </label>
      <button className="btn btn-primary" type="submit">
        {mode === "signin" ? "Sign in" : "Create account"}
      </button>
      {error ? <p className="grade blunder">{error}</p> : null}
    </form>
  );
}
