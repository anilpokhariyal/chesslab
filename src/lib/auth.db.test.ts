import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  checkPass,
  consumeOtp,
  createUser,
  findByEmail,
  findUser,
  issueOtp,
  loadUserProfile,
  makeToken,
  readToken,
  saveUserProfile,
  secret,
  verifyUser,
} from "./auth.ts";

assert.equal(checkPass("x", "nocolon"), false);
assert.equal(checkPass("x", "salt:00"), false);
assert.equal(readToken("nodot", 1), null);
const payload = Buffer.from("not-json").toString("base64url");
const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
assert.equal(readToken(`${payload}.${mac}`), null);
const empty = Buffer.from("{}").toString("base64url");
const mac2 = createHmac("sha256", secret()).update(empty).digest("base64url");
assert.equal(readToken(`${empty}.${mac2}`), null);
assert.ok(makeToken("u1").includes("."));

const prevSecret = process.env.AUTH_SECRET;
delete process.env.AUTH_SECRET;
const secretFile = join(process.cwd(), "data", ".secret");
if (existsSync(secretFile)) rmSync(secretFile);
assert.ok(secret().length >= 32);
assert.equal(secret(), secret());
if (prevSecret) process.env.AUTH_SECRET = prevSecret;

export async function run(): Promise<void> {
  const stamp = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
  const email = `cov-${stamp}@example.com`;

  await assert.rejects(() => createUser("", email, "password1"), /name/);
  await assert.rejects(() => createUser("x".repeat(41), email, "password1"), /name/);
  await assert.rejects(() => createUser("Ada", "not-email", "password1"), /email/);
  await assert.rejects(() => createUser("Ada", email, "short"), /Password/);

  const u = await createUser("Ada Lovelace", email, "password1");
  assert.equal(u.verified, false);
  assert.equal((await findUser(u.id))?.email, email);
  assert.equal(await findUser("missing"), null);
  assert.equal((await findByEmail(email))?.id, u.id);
  assert.equal(await findByEmail("nope@example.com"), null);
  assert.equal((await verifyUser(email, "password1"))?.id, u.id);
  assert.equal(await verifyUser(email, "wrong-pass"), null);
  assert.equal(await verifyUser("nope@example.com", "password1"), null);
  await assert.rejects(() => createUser("Ada", email, "password1"), /already registered/);

  await assert.rejects(() => issueOtp("nope@example.com"), /No account/);
  const code = await issueOtp(email);
  assert.equal(code.length, 6);
  await assert.rejects(() => issueOtp(email, Date.now()), /Wait a moment/);
  await assert.rejects(() => consumeOtp("nope@example.com", code), /No account/);
  await assert.rejects(() => consumeOtp(email, "000000"), /incorrect/);
  await assert.rejects(() => consumeOtp(email, code, Date.now() + 20 * 60_000), /expired/);
  const fresh = await issueOtp(email, Date.now() + 31_000);
  const verified = await consumeOtp(email, fresh, Date.now() + 31_000);
  assert.equal(verified.verified, true);
  assert.equal((await consumeOtp(email, "000000")).verified, true);

  const p = await loadUserProfile(u.id);
  assert.equal(p.name, "Ada Lovelace");
  const saved = await saveUserProfile(u.id, { ...p, theme: "wooden", chessCom: "Ada" });
  assert.equal(saved.chessCom, "ada");
  console.log("auth.db ok");
}
