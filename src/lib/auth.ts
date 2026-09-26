import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Profile } from "./types";

export const COOKIE = "chesslab";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PublicUser = { id: string; name: string; email: string; verified: boolean };

function dataDir(): string {
  return join(process.cwd(), "data");
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

function publicUser(u: { id: string; name: string; email: string; verified: boolean }): PublicUser {
  return { id: u.id, name: u.name, email: u.email, verified: u.verified };
}

export function hashOtp(code: string): string {
  return createHmac("sha256", secret()).update(code.trim()).digest("hex");
}

export function otpMatch(code: string, hash: string): boolean {
  const a = Buffer.from(hashOtp(code));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function db() {
  return (await import("./prisma")).ready();
}

export async function findUser(id: string): Promise<PublicUser | null> {
  const u = await (await db()).user.findUnique({ where: { id } });
  return u ? publicUser(u) : null;
}

export async function createUser(name: string, email: string, password: string): Promise<PublicUser> {
  const n = name.trim();
  const e = email.trim().toLowerCase();
  if (!n || n.length > 40) throw new Error("Enter a name (max 40 characters).");
  if (!EMAIL.test(e)) throw new Error("Enter a valid email.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const id = randomBytes(16).toString("hex");
  try {
    const { DEFAULT_PROFILE } = await import("./profile");
    const u = await (
      await db()
    ).user.create({
      data: {
        id,
        name: n,
        email: e,
        pass: hashPass(password),
        created: BigInt(Date.now()),
        verified: false,
        profile: {
          create: {
            sounds: DEFAULT_PROFILE.sounds,
            openings: {},
          },
        },
      },
    });
    return publicUser(u);
  } catch (err) {
    const { Prisma } = await import("@prisma/client");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("That email is already registered.");
    }
    throw err;
  }
}

export async function verifyUser(email: string, password: string): Promise<PublicUser | null> {
  const u = await (await db()).user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u || !checkPass(password, u.pass)) return null;
  return publicUser(u);
}

export async function findByEmail(email: string): Promise<PublicUser | null> {
  const u = await (await db()).user.findUnique({ where: { email: email.trim().toLowerCase() } });
  return u ? publicUser(u) : null;
}

export async function issueOtp(email: string, now = Date.now()): Promise<string> {
  const client = await db();
  const u = await client.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u) throw new Error("No account with that email.");
  if (u.otpSent && now - Number(u.otpSent) < 30_000) throw new Error("Wait a moment before requesting another code.");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await client.user.update({
    where: { id: u.id },
    data: {
      otpHash: hashOtp(code),
      otpExp: BigInt(now + Number(process.env.OTP_MINUTES ?? 10) * 60_000),
      otpSent: BigInt(now),
    },
  });
  return code;
}

export async function consumeOtp(email: string, code: string, now = Date.now()): Promise<PublicUser> {
  const client = await db();
  const u = await client.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u) throw new Error("No account with that email.");
  if (u.verified) return publicUser(u);
  if (!u.otpHash || !u.otpExp || Number(u.otpExp) < now) throw new Error("That code has expired. Request a new one.");
  if (!otpMatch(code, u.otpHash)) throw new Error("That code is incorrect.");
  const next = await client.user.update({
    where: { id: u.id },
    data: { verified: true, otpHash: null, otpExp: null, otpSent: null },
  });
  return publicUser(next);
}

export async function loadUserProfile(id: string): Promise<Profile> {
  await db();
  return (await import("./persist")).loadAccount(id);
}

export async function saveUserProfile(id: string, raw: unknown): Promise<Profile> {
  await db();
  return (await import("./persist")).saveAccount(id, raw);
}
