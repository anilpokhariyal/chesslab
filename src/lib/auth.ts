import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const COOKIE = "chesslab";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PublicUser = { id: string; name: string; email: string; verified: boolean };
type User = PublicUser & { pass: string; created: number; otpHash?: string; otpExp?: number; otpSent?: number };

function dataDir(): string {
  return join(process.cwd(), "data");
}

function usersPath(): string {
  return join(dataDir(), "users.json");
}

export function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const p = join(dataDir(), ".secret");
  if (!existsSync(p)) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, randomBytes(32).toString("hex"));
  }
  return readFileSync(p, "utf8").trim();
}

export function hashPass(pass: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pass, salt, 32).toString("hex")}`;
}

export function checkPass(pass: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(pass, salt, 32);
  const prev = Buffer.from(hash, "hex");
  return prev.length === next.length && timingSafeEqual(prev, next);
}

export function makeToken(id: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ id, exp: now + MAX_AGE_MS })).toString("base64url");
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function readToken(token: string, now = Date.now()): string | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { id?: string; exp?: number };
    if (!data.id || !data.exp || data.exp < now) return null;
    return data.id;
  } catch {
    return null;
  }
}

function loadUsers(): User[] {
  if (!existsSync(usersPath())) return [];
  try {
    const raw = JSON.parse(readFileSync(usersPath(), "utf8")) as User[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]): void {
  mkdirSync(dataDir(), { recursive: true });
  const tmp = `${usersPath()}.tmp`;
  writeFileSync(tmp, JSON.stringify(users));
  renameSync(tmp, usersPath());
}

function publicUser(u: User): PublicUser {
  return { id: u.id, name: u.name, email: u.email, verified: u.verified !== false };
}

export function hashOtp(code: string): string {
  return createHmac("sha256", secret()).update(code.trim()).digest("hex");
}

export function otpMatch(code: string, hash: string): boolean {
  const a = Buffer.from(hashOtp(code));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

function mutate(email: string, fn: (u: User) => void): User {
  const users = loadUsers();
  const u = users.find((x) => x.email === email.trim().toLowerCase());
  if (!u) throw new Error("No account with that email.");
  fn(u);
  saveUsers(users);
  return u;
}

export function findUser(id: string): PublicUser | null {
  const u = loadUsers().find((x) => x.id === id);
  return u ? publicUser(u) : null;
}

export function createUser(name: string, email: string, password: string): PublicUser {
  const n = name.trim();
  const e = email.trim().toLowerCase();
  if (!n || n.length > 40) throw new Error("Enter a name (max 40 characters).");
  if (!EMAIL.test(e)) throw new Error("Enter a valid email.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const users = loadUsers();
  if (users.some((u) => u.email === e)) throw new Error("That email is already registered.");
  const user: User = {
    id: randomBytes(16).toString("hex"),
    name: n,
    email: e,
    pass: hashPass(password),
    created: Date.now(),
    verified: false,
  };
  users.push(user);
  saveUsers(users);
  return publicUser(user);
}

export function verifyUser(email: string, password: string): PublicUser | null {
  const e = email.trim().toLowerCase();
  const u = loadUsers().find((x) => x.email === e);
  if (!u || !checkPass(password, u.pass)) return null;
  return publicUser(u);
}

export function findByEmail(email: string): PublicUser | null {
  const u = loadUsers().find((x) => x.email === email.trim().toLowerCase());
  return u ? publicUser(u) : null;
}

export function issueOtp(email: string, now = Date.now()): string {
  const wait = 30_000;
  const users = loadUsers();
  const u = users.find((x) => x.email === email.trim().toLowerCase());
  if (!u) throw new Error("No account with that email.");
  if (u.otpSent && now - u.otpSent < wait) throw new Error("Wait a moment before requesting another code.");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  u.otpHash = hashOtp(code);
  u.otpExp = now + Number(process.env.OTP_MINUTES ?? 10) * 60_000;
  u.otpSent = now;
  saveUsers(users);
  return code;
}

export function consumeOtp(email: string, code: string, now = Date.now()): PublicUser {
  const u = mutate(email, (row) => {
    if (row.verified) return;
    if (!row.otpHash || !row.otpExp || row.otpExp < now) throw new Error("That code has expired. Request a new one.");
    if (!otpMatch(code, row.otpHash)) throw new Error("That code is incorrect.");
    row.verified = true;
    delete row.otpHash;
    delete row.otpExp;
    delete row.otpSent;
  });
  return publicUser(u);
}
