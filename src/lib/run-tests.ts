import "./test-env.ts";
import "./classify.test.ts";
import "./auth.test.ts";
import "./promo.test.ts";
import "./outcome.test.ts";
import "./sound.test.ts";
import "./store.test.ts";
import "./extra.test.ts";
import { run as engine } from "./engine.test.ts";
import { run as api } from "./api.test.ts";
import { run as analyze } from "./analyze.test.ts";
import { run as mail } from "./mail.test.ts";
import { run as storeWindow } from "./store.window.test.ts";
import { run as authDb } from "./auth.db.test.ts";
import { run as persist } from "./persist.test.ts";
import { prisma } from "./prisma.ts";

async function main() {
  await engine();
  await api();
  await analyze();
  await mail();
  await storeWindow();
  await authDb();
  await persist();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  void prisma.$disconnect().finally(() => process.exit(1));
});
