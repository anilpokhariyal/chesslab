"use client";

import { useActionState, useState } from "react";
import { resendOtp, verifyEmail } from "@/app/auth-actions";

export function VerifyForm({ email }: { email: string }) {
  const [addr, setAddr] = useState(email);
  const [error, verify] = useActionState(verifyEmail, "");
  const [resent, resend] = useActionState(resendOtp, "");
  return (
    <div className="panel auth" style={{ maxWidth: 400 }}>
      <form action={verify}>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Verification code
          <input
            name="code"
            className="otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="000000"
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Verify email
        </button>
        {error ? <p className="grade blunder">{error}</p> : null}
      </form>
      <form action={resend} style={{ marginTop: 12 }}>
        <input type="hidden" name="email" value={addr} />
        <button className="btn" type="submit">
          Resend code
        </button>
        {resent ? <p className="muted" style={{ marginTop: 8 }}>{resent}</p> : null}
      </form>
    </div>
  );
}
