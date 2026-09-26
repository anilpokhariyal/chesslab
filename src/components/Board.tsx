"use client";

import { Chessboard } from "react-chessboard";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { outcome, type Outcome } from "@/lib/outcome";
import { needsPromo, type PromoPiece } from "@/lib/promo";
import { DEFAULT_SOUNDS, SOUND_KEYS, playSound, whichSound } from "@/lib/sound";
import { THEMES, themeById } from "@/lib/themes";
import { canUseTheme, patchProfile, useProfile } from "@/lib/store";
import type { Arrow, PieceDropHandlerArgs } from "react-chessboard";

type Props = {
  fen: string;
  flipped?: boolean;
  arrows?: Arrow[];
  allowDrag?: boolean;
  onDrop?: (from: string, to: string, promotion?: PromoPiece) => boolean;
  onSquareClick?: (square: string) => void;
  squareStyles?: Record<string, React.CSSProperties>;
  announce?: boolean;
};

const PROMO: { id: PromoPiece; w: string; b: string }[] = [
  { id: "q", w: "♕", b: "♛" },
  { id: "r", w: "♖", b: "♜" },
  { id: "b", w: "♗", b: "♝" },
  { id: "n", w: "♘", b: "♞" },
];

function subscribe() {
  return () => {};
}

export function Board({
  fen,
  flipped,
  arrows,
  allowDrag = true,
  onDrop,
  onSquareClick,
  squareStyles,
  announce,
}: Props) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const profile = useProfile();
  const theme = themeById(canUseTheme(profile.plan, profile.theme) ? profile.theme : "default");
  const [pending, setPending] = useState<{ from: string; to: string; color: "w" | "b" } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [flash, setFlash] = useState<Outcome | null>(null);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!announce) return;
    if (seen.current === null) {
      seen.current = fen;
      return;
    }
    if (seen.current === fen) return;
    seen.current = fen;
    const o = outcome(fen);
    setFlash(o);
    if (o?.kind !== "check") return;
    const t = setTimeout(() => setFlash((f) => (f?.kind === "check" ? null : f)), 1600);
    return () => clearTimeout(t);
  }, [announce, fen]);
  const lastFen = useRef<string | null>(null);
  useEffect(() => {
    if (lastFen.current === null) {
      lastFen.current = fen;
      return;
    }
    const prev = lastFen.current;
    lastFen.current = fen;
    const kind = whichSound(prev, fen, { ...DEFAULT_SOUNDS, ...profile.sounds }, outcome(fen));
    if (kind) playSound(kind, profile.sounds?.volume ?? DEFAULT_SOUNDS.volume);
  }, [fen, profile.sounds]);
  useEffect(() => {
    setPick(null);
  }, [fen]);
  const tryMove = (from: string, to: string) => {
    if (!onDrop) return;
    if (needsPromo(fen, from, to)) {
      setPending({ from, to, color: fen.split(" ")[1] as "w" | "b" });
      return;
    }
    onDrop(from, to);
  };
  if (!mounted) return <div className="board-wrap" style={{ aspectRatio: "1" }} />;

  return (
    <div>
      <div
        className="board-wrap"
        data-pick={pick ?? ""}
        onClickCapture={(e) => {
          const sq = (e.target as HTMLElement).closest("[data-square]")?.getAttribute("data-square");
          if (!sq) return;
          if (onSquareClick) {
            onSquareClick(sq);
            return;
          }
          if (!onDrop || !allowDrag) return;
          if (!pick) {
            setPick(sq);
            return;
          }
          if (pick === sq) {
            setPick(null);
            return;
          }
          tryMove(pick, sq);
          setPick(null);
        }}
      >
        <Chessboard
          options={{
            id: "main",
            position: fen,
            boardOrientation: flipped ? "black" : "white",
            allowDragging: allowDrag,
            arrows: arrows ?? [],
            squareStyles: pick ? { ...squareStyles, [pick]: { ...squareStyles?.[pick], boxShadow: "inset 0 0 0 3px #e8c32d" } } : squareStyles,
            lightSquareStyle: { backgroundColor: theme.light },
            darkSquareStyle: { backgroundColor: theme.dark },
            boardStyle: { width: "100%", borderRadius: 4, overflow: "hidden" },
            onPieceDrop: onDrop
              ? ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
                  if (!targetSquare) return false;
                  if (needsPromo(fen, sourceSquare, targetSquare)) {
                    setPending({ from: sourceSquare, to: targetSquare, color: fen.split(" ")[1] as "w" | "b" });
                    return false;
                  }
                  return onDrop(sourceSquare, targetSquare);
                }
              : undefined,
          }}
        />
        {flash && (
          <div className={`flash ${flash.kind}`} onClick={() => flash.kind === "end" && setFlash(null)}>
            <b>{flash.text}</b>
          </div>
        )}
        {pending && (
          <div className="promo" onClick={() => setPending(null)}>
            {PROMO.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDrop?.(pending.from, pending.to, p.id);
                  setPending(null);
                }}
              >
                {pending.color === "w" ? p.w : p.b}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="row" style={{ justifyContent: "center", marginTop: 6 }}>
        {THEMES.filter((t) => !t.premium).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${theme.id === t.id ? "btn-primary" : ""}`}
            onClick={() => patchProfile((p) => ({ ...p, theme: t.id }))}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "center", marginTop: 6 }}>
        {SOUND_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`btn ${profile.sounds[k] ? "btn-primary" : ""}`}
            onClick={() =>
              patchProfile((p) => ({
                ...p,
                sounds: { ...DEFAULT_SOUNDS, ...p.sounds, [k]: !p.sounds[k] },
              }))
            }
          >
            {k === "end" ? "Mate" : k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          aria-label="Volume"
          value={profile.sounds.volume}
          onChange={(e) =>
            patchProfile((p) => ({
              ...p,
              sounds: { ...DEFAULT_SOUNDS, ...p.sounds, volume: Number(e.target.value) },
            }))
          }
          style={{ maxWidth: 100 }}
        />
      </div>
    </div>
  );
}
