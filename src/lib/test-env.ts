import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k === "DATABASE_URL" || k === "MYSQL_URL" || k === "AUTH_SECRET" || k === "OTP_MINUTES") {
      process.env[k] ??= v;
    }
  }
}
process.env.DATABASE_URL ??= "mysql://chesslab:chesslab@127.0.0.1:3306/chesslab";
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret";
