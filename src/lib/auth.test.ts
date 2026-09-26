import assert from "node:assert/strict";
import { checkPass, hashOtp, hashPass, makeToken, otpMatch, readToken } from "./auth.ts";

process.env.AUTH_SECRET = "x".repeat(32);

const stored = hashPass("hunter22");
assert.equal(checkPass("hunter22", stored), true);
assert.equal(checkPass("wrong-pass", stored), false);

const token = makeToken("user-1", 1_000);
assert.equal(readToken(token, 1_000), "user-1");
assert.equal(readToken(token, 1_000 + 31 * 24 * 60 * 60 * 1000), null);
assert.equal(readToken(token.slice(0, -1) + "x", 1_000), null);

const otp = hashOtp("123456");
assert.equal(otpMatch("123456", otp), true);
assert.equal(otpMatch("000000", otp), false);

console.log("auth ok");
