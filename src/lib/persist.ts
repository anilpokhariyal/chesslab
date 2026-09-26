import type { Game, GameKind, GameNote, Plan, Side } from "@prisma/client";
import { prisma } from "./prisma";
import { parseProfile } from "./profile";
import type { AnalyzedMove, GameDraft, PlayedGame, Profile, SavedAnalysis } from "./types";

function num(x: bigint | number): number {
  return Number(x);
}

function asPlan(p: string): Plan {
  return p === "premium" || p === "coach" ? p : "free";
}

function asSide(s: string): Side {
  return s === "b" ? "b" : "w";
}

function asKind(k: string): GameKind {
  return k === "coach" || k === "analyze" ? k : "play";
}

function draftId(userId: string, kind: "play" | "coach"): string {
  return `${kind === "play" ? "p" : "c"}-${userId}`;
}

function draftOf(g: Game & { notes: GameNote[] }): GameDraft {
  return {
    opp: g.opp,
    elo: g.elo,
    side: g.side,
    fen: g.fen,
    pgn: g.pgn,
    status: g.result || "in progress",
    mode: g.mode === "play" || g.mode === "basics" || g.mode === "full" ? g.mode : undefined,
    log: g.notes.map((x) => ({
      who: x.who === "bot" || x.who === "sys" ? x.who : "you",
      text: x.text,
      ply: x.ply,
    })),
  };
}

export async function loadAccount(userId: string): Promise<Profile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      games: { include: { notes: { orderBy: { ply: "asc" } } }, orderBy: { updatedAt: "desc" } },
      analyses: { include: { moves: { orderBy: { ply: "asc" } } }, orderBy: { at: "desc" }, take: 40 },
    },
  });
  if (!user) throw new Error("Not signed in.");
  const prof = user.profile;
  const play = user.games.find((g) => g.kind === "play" && g.status === "active");
  const coach = user.games.find((g) => g.kind === "coach" && g.status === "active");
  const games: PlayedGame[] = user.games
    .filter((g) => g.status === "finished" && g.kind !== "analyze")
    .slice(0, 40)
    .map((g) => ({
      id: g.id,
      at: num(g.startedAt),
      kind: g.kind === "coach" ? "coach" : "play",
      pgn: g.pgn,
      result: g.result,
      opp: g.opp,
    }));
  const analyses: SavedAnalysis[] = user.analyses.map((a) => ({
    id: a.id,
    at: num(a.at),
    white: a.white,
    black: a.black,
    result: a.result,
    pgn: a.pgn,
    opening: a.opening ?? undefined,
    whiteAccuracy: a.whiteAccuracy,
    blackAccuracy: a.blackAccuracy,
    whiteAcpl: a.whiteAcpl,
    blackAcpl: a.blackAcpl,
    moves: a.moves.map(
      (m): AnalyzedMove => ({
        san: m.san,
        uci: m.uci,
        fenBefore: m.fenBefore,
        fenAfter: m.fenAfter,
        color: m.color,
        cpl: m.cpl,
        grade: m.grade as AnalyzedMove["grade"],
        bestSan: m.bestSan,
        bestUci: m.bestUci,
        evalBefore: m.evalBefore as AnalyzedMove["evalBefore"],
        evalAfter: m.evalAfter as AnalyzedMove["evalAfter"],
      }),
    ),
  }));
  return parseProfile({
    name: user.name,
    plan: prof?.plan ?? "free",
    puzzleRating: prof?.puzzleRating ?? 1200,
    streak: prof?.streak ?? 0,
    solved: prof?.solved ?? 0,
    failed: prof?.failed ?? 0,
    bestStreak: prof?.bestStreak ?? 0,
    theme: prof?.theme ?? "default",
    sounds: prof?.sounds,
    lastAnalysisId: prof?.lastAnalysisId ?? null,
    openings: prof?.openings,
    coordBest: prof?.coordBest ?? 0,
    chessCom: prof?.chessCom ?? "",
    lichess: prof?.lichess ?? "",
    games,
    play: play ? draftOf(play) : null,
    coach: coach ? draftOf(coach) : null,
    analyses,
  });
}

async function writeDraft(
  userId: string,
  kind: "play" | "coach",
  draft: GameDraft | null,
  now: bigint,
): Promise<void> {
  const id = draftId(userId, kind);
  if (!draft) {
    await prisma.game.updateMany({
      where: { id, userId, status: "active" },
      data: { status: "abandoned", updatedAt: now },
    });
    return;
  }
  await prisma.game.upsert({
    where: { id },
    create: {
      id,
      userId,
      kind,
      status: "active",
      opp: draft.opp.slice(0, 80),
      elo: draft.elo,
      side: asSide(draft.side),
      fen: draft.fen.slice(0, 128),
      pgn: draft.pgn,
      result: draft.status.slice(0, 80),
      mode: draft.mode ?? null,
      startedAt: now,
      updatedAt: now,
    },
    update: {
      status: "active",
      opp: draft.opp.slice(0, 80),
      elo: draft.elo,
      side: asSide(draft.side),
      fen: draft.fen.slice(0, 128),
      pgn: draft.pgn,
      result: draft.status.slice(0, 80),
      mode: draft.mode ?? null,
      updatedAt: now,
    },
  });
  await prisma.gameNote.deleteMany({ where: { gameId: id } });
  if (draft.log?.length) {
    await prisma.gameNote.createMany({
      data: draft.log.map((n, i) => ({
        id: `${id}-n${i}`,
        gameId: id,
        ply: n.ply ?? i,
        who: n.who.slice(0, 8),
        text: n.text,
        at: now,
      })),
    });
  }
}

async function writeFinished(userId: string, g: PlayedGame, now: bigint): Promise<void> {
  await prisma.game.upsert({
    where: { id: g.id },
    create: {
      id: g.id.slice(0, 40),
      userId,
      kind: asKind(g.kind),
      status: "finished",
      opp: g.opp.slice(0, 80),
      elo: 0,
      side: "w",
      fen: "",
      pgn: g.pgn,
      result: g.result.slice(0, 80),
      startedAt: BigInt(g.at),
      updatedAt: now,
    },
    update: {
      status: "finished",
      pgn: g.pgn,
      result: g.result.slice(0, 80),
      opp: g.opp.slice(0, 80),
      updatedAt: now,
    },
  });
}

async function writeAnalysis(userId: string, a: SavedAnalysis, now: bigint): Promise<void> {
  const id = a.id.slice(0, 40);
  await prisma.game.upsert({
    where: { id },
    create: {
      id,
      userId,
      kind: "analyze",
      status: "finished",
      opp: `${a.white} vs ${a.black}`.slice(0, 80),
      elo: 0,
      side: "w",
      fen: "",
      pgn: a.pgn,
      result: a.result.slice(0, 16),
      startedAt: BigInt(a.at),
      updatedAt: now,
    },
    update: {
      pgn: a.pgn,
      result: a.result.slice(0, 16),
      opp: `${a.white} vs ${a.black}`.slice(0, 80),
      updatedAt: now,
    },
  });
  await prisma.analysis.upsert({
    where: { id },
    create: {
      id,
      userId,
      gameId: id,
      at: BigInt(a.at),
      white: a.white.slice(0, 64),
      black: a.black.slice(0, 64),
      result: a.result.slice(0, 16),
      pgn: a.pgn,
      opening: a.opening?.slice(0, 128) ?? null,
      whiteAccuracy: a.whiteAccuracy,
      blackAccuracy: a.blackAccuracy,
      whiteAcpl: a.whiteAcpl,
      blackAcpl: a.blackAcpl,
    },
    update: {
      at: BigInt(a.at),
      white: a.white.slice(0, 64),
      black: a.black.slice(0, 64),
      result: a.result.slice(0, 16),
      pgn: a.pgn,
      opening: a.opening?.slice(0, 128) ?? null,
      whiteAccuracy: a.whiteAccuracy,
      blackAccuracy: a.blackAccuracy,
      whiteAcpl: a.whiteAcpl,
      blackAcpl: a.blackAcpl,
      gameId: id,
    },
  });
  await prisma.analysisMove.deleteMany({ where: { analysisId: id } });
  if (a.moves.length) {
    await prisma.analysisMove.createMany({
      data: a.moves.map((m, ply) => ({
        id: `${id}-m${ply}`,
        analysisId: id,
        ply,
        san: m.san.slice(0, 16),
        uci: m.uci.slice(0, 8),
        fenBefore: m.fenBefore.slice(0, 128),
        fenAfter: m.fenAfter.slice(0, 128),
        color: asSide(m.color),
        cpl: m.cpl,
        grade: m.grade.slice(0, 16),
        bestSan: m.bestSan.slice(0, 16),
        bestUci: m.bestUci.slice(0, 8),
        evalBefore: m.evalBefore,
        evalAfter: m.evalAfter,
      })),
    });
  }
}

export async function saveAccount(userId: string, raw: unknown): Promise<Profile> {
  const p = parseProfile(raw);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Not signed in.");
  const now = BigInt(Date.now());
  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      plan: asPlan(p.plan),
      puzzleRating: p.puzzleRating,
      streak: p.streak,
      solved: p.solved,
      failed: p.failed,
      bestStreak: p.bestStreak,
      theme: p.theme.slice(0, 32),
      sounds: p.sounds,
      coordBest: p.coordBest,
      lastAnalysisId: p.lastAnalysisId,
      openings: p.openings,
      chessCom: p.chessCom.slice(0, 64),
      lichess: p.lichess.slice(0, 64),
    },
    update: {
      plan: asPlan(p.plan),
      puzzleRating: p.puzzleRating,
      streak: p.streak,
      solved: p.solved,
      failed: p.failed,
      bestStreak: p.bestStreak,
      theme: p.theme.slice(0, 32),
      sounds: p.sounds,
      coordBest: p.coordBest,
      lastAnalysisId: p.lastAnalysisId,
      openings: p.openings,
      chessCom: p.chessCom.slice(0, 64),
      lichess: p.lichess.slice(0, 64),
    },
  });
  if (p.name && p.name !== user.name) {
    await prisma.user.update({ where: { id: userId }, data: { name: p.name.slice(0, 40) } });
  }
  await writeDraft(userId, "play", p.play, now);
  await writeDraft(userId, "coach", p.coach, now);
  for (const g of p.games.slice(0, 40)) await writeFinished(userId, g, now);
  for (const a of p.analyses.slice(0, 40)) await writeAnalysis(userId, a, now);
  const extraGames = await prisma.game.findMany({
    where: { userId, status: "finished", kind: { in: ["play", "coach"] } },
    orderBy: { startedAt: "desc" },
    skip: 40,
    select: { id: true },
  });
  const extraAnalyses = await prisma.analysis.findMany({
    where: { userId },
    orderBy: { at: "desc" },
    skip: 40,
    select: { id: true },
  });
  if (extraGames.length) await prisma.game.deleteMany({ where: { id: { in: extraGames.map((x) => x.id) } } });
  if (extraAnalyses.length) {
    await prisma.analysis.deleteMany({ where: { id: { in: extraAnalyses.map((x) => x.id) } } });
    await prisma.game.deleteMany({ where: { id: { in: extraAnalyses.map((x) => x.id) }, kind: "analyze" } });
  }
  return loadAccount(userId);
}
